import Database from "better-sqlite3";
import { faker } from "@faker-js/faker";
import { setupTables } from "../../src/db.js";

/**
 * Mixed Read/Write Scenario Setup
 * 
 * Configuration:
 * - PRAGMA journal_mode = WAL
 * - PRAGMA synchronous = NORMAL
 * - PRAGMA temp_store = memory (database-level, set here)
 * - PRAGMA cache_size = -16000 (16MB page cache)
 * 
 * Connection-level pragmas (set by workers):
 * - PRAGMA busy_timeout = 2000ms
 * - PRAGMA wal_autocheckpoint = 4000
 * - PRAGMA mmap_size = 1000000000 (1GB, connection-level, set in worker)
 * 
 * Additional optimizations:
 * - temp_store = memory: Stores temporary tables and indices in memory instead of disk
 * - mmap_size = 1GB: Uses memory-mapped I/O for faster reads
 * 
 * Seeds the database with initial data for read queries.
 */

// Seed configuration
const SEED_USERS = 5000;
const SEED_POSTS = 20000;
const SEED_TAGS = 1000;
const SEED_USER_POSTS = 15000;
const SEED_POSTS_TAGS = 5000;

export interface SeedResult {
    userIds: number[];
    postIds: number[];
    tagIds: number[];
}

export function setup(dbPath: string): SeedResult {
    const db = new Database(dbPath);
    
    // Database-level pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = memory');
    db.pragma('cache_size = -16000'); // 16MB page cache
    
    // Create tables
    setupTables(db);
    
    // Create indexes for read queries
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
        CREATE INDEX IF NOT EXISTS idx_user_posts_user_id ON user_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_posts_post_id ON user_posts(post_id);
        CREATE INDEX IF NOT EXISTS idx_posts_tags_post_id ON posts_tags(post_id);
        CREATE INDEX IF NOT EXISTS idx_posts_tags_tag_id ON posts_tags(tag_id);
    `);
    
    console.log("Seeding database with initial data...");
    
    const userIds: number[] = [];
    const postIds: number[] = [];
    const tagIds: number[] = [];
    
    // Seed users
    const insertUser = db.prepare("INSERT INTO users (name, created_at) VALUES (?, ?)");
    const insertUsers = db.transaction(() => {
        for (let i = 0; i < SEED_USERS; i++) {
            const result = insertUser.run(
                faker.person.fullName(),
                faker.date.past({ years: 2 }).toISOString()
            );
            userIds.push(Number(result.lastInsertRowid));
        }
    });
    insertUsers();
    console.log(`  Seeded ${userIds.length} users`);
    
    // Seed tags
    const insertTag = db.prepare("INSERT INTO tags (name) VALUES (?)");
    const insertTags = db.transaction(() => {
        for (let i = 0; i < SEED_TAGS; i++) {
            const result = insertTag.run(faker.lorem.word());
            tagIds.push(Number(result.lastInsertRowid));
        }
    });
    insertTags();
    console.log(`  Seeded ${tagIds.length} tags`);
    
    // Seed posts
    const insertPost = db.prepare("INSERT INTO posts (title, content, created_at) VALUES (?, ?, ?)");
    const insertPosts = db.transaction(() => {
        for (let i = 0; i < SEED_POSTS; i++) {
            const result = insertPost.run(
                faker.lorem.sentence(),
                faker.lorem.paragraphs(2),
                faker.date.past({ years: 2 }).toISOString()
            );
            postIds.push(Number(result.lastInsertRowid));
        }
    });
    insertPosts();
    console.log(`  Seeded ${postIds.length} posts`);
    
    // Seed user_posts relations
    const insertUserPost = db.prepare("INSERT INTO user_posts (user_id, post_id) VALUES (?, ?)");
    const insertUserPosts = db.transaction(() => {
        const usedPairs = new Set<string>();
        let inserted = 0;
        while (inserted < SEED_USER_POSTS) {
            const userId = faker.helpers.arrayElement(userIds);
            const postId = faker.helpers.arrayElement(postIds);
            const key = `${userId}-${postId}`;
            if (!usedPairs.has(key)) {
                usedPairs.add(key);
                insertUserPost.run(userId, postId);
                inserted++;
            }
        }
    });
    insertUserPosts();
    console.log(`  Seeded ${SEED_USER_POSTS} user-post relations`);
    
    // Seed posts_tags relations
    const insertPostTag = db.prepare("INSERT INTO posts_tags (post_id, tag_id) VALUES (?, ?)");
    const insertPostTags = db.transaction(() => {
        const usedPairs = new Set<string>();
        let inserted = 0;
        while (inserted < SEED_POSTS_TAGS) {
            const postId = faker.helpers.arrayElement(postIds);
            const tagId = faker.helpers.arrayElement(tagIds);
            const key = `${postId}-${tagId}`;
            if (!usedPairs.has(key)) {
                usedPairs.add(key);
                insertPostTag.run(postId, tagId);
                inserted++;
            }
        }
    });
    insertPostTags();
    console.log(`  Seeded ${SEED_POSTS_TAGS} post-tag relations`);
    
    db.close();
    
    console.log("Database seeding complete.");
    
    return { userIds, postIds, tagIds };
}

