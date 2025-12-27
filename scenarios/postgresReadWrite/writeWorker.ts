import { Client } from "pg";
import type { WriteResult } from "../../src/workerCore.js";
import type { PostgresWriteTask } from "../../src/postgresWorkerCore.js";

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
 * PostgreSQL Read/Write Scenario - Write Worker
 * 
 * Executes write operations using PostgreSQL connection pool.
 */
export default async function worker(task: PostgresWriteTask): Promise<WriteResult> {
    const startTime = performance.now();
    const client = await getClient(task.connectionString);
    
    try {
        let insertedId: number | undefined;
        
        switch (task.writeType) {
            case "user": {
                const result = await client.query(
                    "INSERT INTO users (name) VALUES ($1) RETURNING id",
                    [task.data.userName!]
                );
                insertedId = Number(result.rows[0]!.id);
                break;
            }
            case "post": {
                const result = await client.query(
                    "INSERT INTO posts (title, content) VALUES ($1, $2) RETURNING id",
                    [task.data.postTitle!, task.data.postContent!]
                );
                insertedId = Number(result.rows[0]!.id);
                break;
            }
            case "tag": {
                const result = await client.query(
                    "INSERT INTO tags (name) VALUES ($1) RETURNING id",
                    [task.data.tagName!]
                );
                insertedId = Number(result.rows[0]!.id);
                break;
            }
            case "user_post": {
                await client.query(
                    "INSERT INTO user_posts (user_id, post_id) VALUES ($1, $2)",
                    [task.data.userId!, task.data.postId!]
                );
                break;
            }
            case "post_tag": {
                await client.query(
                    "INSERT INTO posts_tags (post_id, tag_id) VALUES ($1, $2)",
                    [task.data.postId!, task.data.tagId!]
                );
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
            errorCode: isLockError(error) ? "POSTGRES_LOCK" : "OTHER_ERROR"
        };
    }
}

