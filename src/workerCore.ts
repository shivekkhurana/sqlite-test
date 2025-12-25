import type Database from "better-sqlite3";

export interface WriteResult {
    success: boolean;
    duration: number;
    error?: string;
    errorCode?: string;
    insertedId?: number;
}

type WriteType = "user" | "post" | "tag" | "user_post" | "post_tag";

export interface WriteTask {
    dbPath: string;
    writeType: WriteType;
    cacheSize?: number; // PRAGMA cache_size value (e.g., -16000 for 16MB)
    data: {
        userName?: string;
        postTitle?: string;
        postContent?: string;
        tagName?: string;
        userId?: number;
        postId?: number;
        tagId?: number;
    };
}

function isLockError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return msg.includes("database is locked") || msg.includes("sqlite_busy");
    }
    return false;
}

/**
 * Execute a write operation on an already-configured database connection.
 * The caller is responsible for opening the DB with appropriate pragmas.
 */
export function executeWrite(db: Database.Database, task: WriteTask): WriteResult {
    const startTime = performance.now();
    
    try {
        let insertedId: number | undefined;
        
        switch (task.writeType) {
            case "user": {
                const stmt = db.prepare("INSERT INTO users (name) VALUES (?)");
                const result = stmt.run(task.data.userName!);
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "post": {
                const stmt = db.prepare("INSERT INTO posts (title, content) VALUES (?, ?)");
                const result = stmt.run(task.data.postTitle!, task.data.postContent!);
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "tag": {
                const stmt = db.prepare("INSERT INTO tags (name) VALUES (?)");
                const result = stmt.run(task.data.tagName!);
                insertedId = Number(result.lastInsertRowid);
                break;
            }
            case "user_post": {
                const stmt = db.prepare("INSERT INTO user_posts (user_id, post_id) VALUES (?, ?)");
                stmt.run(task.data.userId!, task.data.postId!);
                break;
            }
            case "post_tag": {
                const stmt = db.prepare("INSERT INTO posts_tags (post_id, tag_id) VALUES (?, ?)");
                stmt.run(task.data.postId!, task.data.tagId!);
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
        db.close();
    }
}

