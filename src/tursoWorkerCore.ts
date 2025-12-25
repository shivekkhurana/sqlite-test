import { createClient, type Client } from "@libsql/client";
import type { WriteResult, WriteTask } from "./workerCore.js";
import type { ReadResult, ReadTask, ReadQueryType } from "./readWorkerCore.js";

function isLockError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes("database is locked") || 
               msg.includes("sqlite_busy") ||
               msg.includes("busy");
    }
    return false;
}

/**
 * Create a libSQL client for local embedded mode
 */
function createTursoClient(dbPath: string): Client {
    return createClient({
        url: `file:${dbPath}`
    });
}

/**
 * Execute a write operation using libSQL client (async)
 */
export async function executeTursoWrite(task: WriteTask): Promise<WriteResult> {
    const startTime = performance.now();
    const client = createTursoClient(task.dbPath);
    
    try {
        let insertedId: number | undefined;
        
        switch (task.writeType) {
            case "user": {
                const result = await client.execute({
                    sql: "INSERT INTO users (name) VALUES (?)",
                    args: [task.data.userName!]
                });
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "post": {
                const result = await client.execute({
                    sql: "INSERT INTO posts (title, content) VALUES (?, ?)",
                    args: [task.data.postTitle!, task.data.postContent!]
                });
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "tag": {
                const result = await client.execute({
                    sql: "INSERT INTO tags (name) VALUES (?)",
                    args: [task.data.tagName!]
                });
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "user_post": {
                await client.execute({
                    sql: "INSERT INTO user_posts (user_id, post_id) VALUES (?, ?)",
                    args: [task.data.userId!, task.data.postId!]
                });
                break;
            }
            case "post_tag": {
                await client.execute({
                    sql: "INSERT INTO posts_tags (post_id, tag_id) VALUES (?, ?)",
                    args: [task.data.postId!, task.data.tagId!]
                });
                break;
            }
        }
        
        return {
            success: true,
            duration: performance.now() - startTime,
            insertedId
        };
    } catch (error) {
        return {
            success: false,
            duration: performance.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
            errorCode: isLockError(error) ? "SQLITE_LOCK" : "OTHER_ERROR"
        };
    } finally {
        client.close();
    }
}

/**
 * Execute a read operation using libSQL client (async)
 */
export async function executeTursoRead(task: ReadTask): Promise<ReadResult> {
    const startTime = performance.now();
    const client = createTursoClient(task.dbPath);
    
    try {
        let rows: unknown[];
        
        switch (task.queryType) {
            case "posts_for_user": {
                const result = await client.execute({
                    sql: `
                        SELECT p.id, p.title, p.content, p.created_at, p.updated_at
                        FROM posts p
                        JOIN user_posts up ON p.id = up.post_id
                        WHERE up.user_id = ?
                        ORDER BY p.created_at DESC
                        LIMIT 100 OFFSET ?
                    `,
                    args: [task.params.userId!, task.params.offset ?? 0]
                });
                rows = result.rows;
                break;
            }
            
            case "posts_in_timeframe": {
                const result = await client.execute({
                    sql: `
                        SELECT id, title, content, created_at, updated_at
                        FROM posts
                        WHERE created_at BETWEEN ? AND ?
                        ORDER BY created_at DESC
                        LIMIT 100 OFFSET ?
                    `,
                    args: [
                        task.params.startDate!,
                        task.params.endDate!,
                        task.params.offset ?? 0
                    ]
                });
                rows = result.rows;
                break;
            }
            
            case "single_post_with_details": {
                const result = await client.execute({
                    sql: `
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
                        WHERE p.id = ?
                    `,
                    args: [task.params.postId!]
                });
                rows = result.rows;
                break;
            }
            
            case "users_in_timeframe": {
                const result = await client.execute({
                    sql: `
                        SELECT id, name, created_at, updated_at
                        FROM users
                        WHERE created_at BETWEEN ? AND ?
                        ORDER BY created_at DESC
                    `,
                    args: [task.params.startDate!, task.params.endDate!]
                });
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
            errorCode: isLockError(error) ? "SQLITE_BUSY" : "OTHER_ERROR"
        };
    } finally {
        client.close();
    }
}

