import { Client } from "pg";
import type { ReadResult, ReadQueryType } from "../../src/readWorkerCore.js";
import type { PostgresReadTask } from "../../src/postgresWorkerCore.js";

// Create a single client per worker thread (reused across all tasks)
let client: Client | null = null;

async function getClient(connectionString: string): Promise<Client> {
    if (!client) {
        client = new Client({ connectionString });
        await client.connect();
    }
    return client;
}

function isLockError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes("deadlock") || 
               msg.includes("lock") ||
               msg.includes("could not serialize") ||
               msg.includes("serialization failure");
    }
    return false;
}

/**
 * PostgreSQL Read/Write Scenario - Read Worker
 * 
 * Executes read operations using PostgreSQL connection pool.
 */
export default async function worker(task: PostgresReadTask): Promise<ReadResult> {
    const startTime = performance.now();
    const client = await getClient(task.connectionString);
    
    try {
        let rows: unknown[];
        
        switch (task.queryType) {
            case "posts_for_user": {
                const result = await client.query(`
                    SELECT p.id, p.title, p.content, p.created_at, p.updated_at
                    FROM posts p
                    JOIN user_posts up ON p.id = up.post_id
                    WHERE up.user_id = $1
                    ORDER BY p.created_at DESC
                    LIMIT 100 OFFSET $2
                `, [task.params.userId!, task.params.offset ?? 0]);
                rows = result.rows;
                break;
            }
            
            case "posts_in_timeframe": {
                const result = await client.query(`
                    SELECT id, title, content, created_at, updated_at
                    FROM posts
                    WHERE created_at BETWEEN $1 AND $2
                    ORDER BY created_at DESC
                    LIMIT 100 OFFSET $3
                `, [
                    task.params.startDate!,
                    task.params.endDate!,
                    task.params.offset ?? 0
                ]);
                rows = result.rows;
                break;
            }
            
            case "single_post_with_details": {
                const result = await client.query(`
                    SELECT 
                        p.id as post_id,
                        p.title,
                        p.content,
                        p.created_at as post_created_at,
                        u.id as user_id,
                        u.name as user_name,
                        t.id as tag_id,
                        t.name as tag_name
                    FROM posts p
                    LEFT JOIN user_posts up ON p.id = up.post_id
                    LEFT JOIN users u ON up.user_id = u.id
                    LEFT JOIN posts_tags pt ON p.id = pt.post_id
                    LEFT JOIN tags t ON pt.tag_id = t.id
                    WHERE p.id = $1
                `, [task.params.postId!]);
                rows = result.rows;
                break;
            }
            
            case "users_in_timeframe": {
                const result = await client.query(`
                    SELECT id, name, created_at, updated_at
                    FROM users
                    WHERE created_at BETWEEN $1 AND $2
                    ORDER BY created_at DESC
                `, [task.params.startDate!, task.params.endDate!]);
                rows = result.rows;
                break;
            }
            
            default:
                throw new Error(`Unknown query type: ${task.queryType}`);
        }
        
        return {
            success: true,
            duration: performance.now() - startTime,
            rowCount: rows.length,
            queryType: task.queryType
        };
    } catch (error) {
        return {
            success: false,
            duration: performance.now() - startTime,
            rowCount: 0,
            queryType: task.queryType,
            error: error instanceof Error ? error.message : String(error),
            errorCode: isLockError(error) ? "POSTGRES_LOCK" : "OTHER_ERROR"
        };
    }
}

