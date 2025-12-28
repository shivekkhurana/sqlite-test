import type Database from "better-sqlite3";

export interface ReadResult {
    success: boolean;
    duration: number;
    rowCount: number;
    queryType: ReadQueryType;
    error?: string;
    errorCode?: string;
}

export type ReadQueryType = 
    | "posts_for_user"           // Posts for a user (paginated, 100)
    | "posts_in_timeframe"       // Posts in time frame (paginated, 100)
    | "single_post_with_details" // Single post with tags and user
    | "users_in_timeframe";      // Users joined in time frame

export interface ReadTask {
    dbPath: string;
    queryType: ReadQueryType;
    cacheSize?: number; // PRAGMA cache_size value (e.g., -16000 for 16MB)
    params: {
        userId?: number;
        postId?: number;
        startDate?: string;
        endDate?: string;
        offset?: number;
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
 * Execute a read operation on an already-configured database connection.
 * The caller is responsible for opening the DB with appropriate pragmas.
 */
export function executeRead(db: Database.Database, task: ReadTask): ReadResult {
    const startTime = performance.now();
    
    try {
        let rows: unknown[];
        
        switch (task.queryType) {
            case "posts_for_user": {
                // Get posts for a user via the user_posts junction table
                const stmt = db.prepare(`
                    SELECT p.id, p.title, p.content, p.created_at, p.updated_at
                    FROM posts p
                    JOIN user_posts up ON p.id = up.post_id
                    WHERE up.user_id = ?
                    ORDER BY p.created_at DESC
                    LIMIT 100 OFFSET ?
                `);
                rows = stmt.all(task.params.userId!, task.params.offset ?? 0);
                break;
            }
            
            case "posts_in_timeframe": {
                // Get posts within a time frame
                const stmt = db.prepare(`
                    SELECT id, title, content, created_at, updated_at
                    FROM posts
                    WHERE created_at BETWEEN ? AND ?
                    ORDER BY created_at DESC
                    LIMIT 100 OFFSET ?
                `);
                rows = stmt.all(
                    task.params.startDate!,
                    task.params.endDate!,
                    task.params.offset ?? 0
                );
                break;
            }
            
            case "single_post_with_details": {
                // Get a single post with its user and tags (multiple JOINs)
                const stmt = db.prepare(`
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
                `);
                rows = stmt.all(task.params.postId!);
                break;
            }
            
            case "users_in_timeframe": {
                // Get users who joined within a time frame
                const stmt = db.prepare(`
                    SELECT id, name, created_at, updated_at
                    FROM users
                    WHERE created_at BETWEEN ? AND ?
                    ORDER BY created_at DESC
                    LIMIT 100
                `);
                rows = stmt.all(task.params.startDate!, task.params.endDate!);
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
        db.close();
    }
}

