import { createClient } from "@libsql/client";
import { faker } from "@faker-js/faker";

/**
 * Turso Read/Write Scenario Setup
 * 
 * Uses libSQL in local embedded mode (file: protocol).
 * Note: Some PRAGMAs may not be available in libSQL.
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

async function setupTables(client: ReturnType<typeof createClient>) {
    await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS user_posts (
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (post_id) REFERENCES posts (id)
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.execute(`
        CREATE TABLE IF NOT EXISTS posts_tags (
            post_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts (id),
            FOREIGN KEY (tag_id) REFERENCES tags (id)
        )
    `);
}

export async function setup(dbPath: string): Promise<SeedResult> {
    const client = createClient({
        url: `file:${dbPath}`
    });
    
    try {
        // Create tables
        await setupTables(client);
        
        // Create indexes for read queries
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_user_posts_user_id ON user_posts(user_id);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_user_posts_post_id ON user_posts(post_id);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_posts_tags_post_id ON posts_tags(post_id);
        `);
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_posts_tags_tag_id ON posts_tags(tag_id);
        `);
        
        console.log("Seeding database with initial data...");
        
        const userIds: number[] = [];
        const postIds: number[] = [];
        const tagIds: number[] = [];
        
        // Seed users
        for (let i = 0; i < SEED_USERS; i++) {
            const result = await client.execute({
                sql: "INSERT INTO users (name, created_at) VALUES (?, ?)",
                args: [
                    faker.person.fullName(),
                    faker.date.past({ years: 2 }).toISOString()
                ]
            });
            userIds.push(Number(result.lastInsertRowid));
        }
        console.log(`  Seeded ${userIds.length} users`);
        
        // Seed tags
        for (let i = 0; i < SEED_TAGS; i++) {
            const result = await client.execute({
                sql: "INSERT INTO tags (name) VALUES (?)",
                args: [faker.lorem.word()]
            });
            tagIds.push(Number(result.lastInsertRowid));
        }
        console.log(`  Seeded ${tagIds.length} tags`);
        
        // Seed posts
        for (let i = 0; i < SEED_POSTS; i++) {
            const result = await client.execute({
                sql: "INSERT INTO posts (title, content, created_at) VALUES (?, ?, ?)",
                args: [
                    faker.lorem.sentence(),
                    faker.lorem.paragraphs(2),
                    faker.date.past({ years: 2 }).toISOString()
                ]
            });
            postIds.push(Number(result.lastInsertRowid));
        }
        console.log(`  Seeded ${postIds.length} posts`);
        
        // Seed user_posts relations
        const usedUserPostPairs = new Set<string>();
        let insertedUserPosts = 0;
        while (insertedUserPosts < SEED_USER_POSTS) {
            const userId = faker.helpers.arrayElement(userIds);
            const postId = faker.helpers.arrayElement(postIds);
            const key = `${userId}-${postId}`;
            if (!usedUserPostPairs.has(key)) {
                usedUserPostPairs.add(key);
                await client.execute({
                    sql: "INSERT INTO user_posts (user_id, post_id) VALUES (?, ?)",
                    args: [userId, postId]
                });
                insertedUserPosts++;
            }
        }
        console.log(`  Seeded ${SEED_USER_POSTS} user-post relations`);
        
        // Seed posts_tags relations
        const usedPostTagPairs = new Set<string>();
        let insertedPostTags = 0;
        while (insertedPostTags < SEED_POSTS_TAGS) {
            const postId = faker.helpers.arrayElement(postIds);
            const tagId = faker.helpers.arrayElement(tagIds);
            const key = `${postId}-${tagId}`;
            if (!usedPostTagPairs.has(key)) {
                usedPostTagPairs.add(key);
                await client.execute({
                    sql: "INSERT INTO posts_tags (post_id, tag_id) VALUES (?, ?)",
                    args: [postId, tagId]
                });
                insertedPostTags++;
            }
        }
        console.log(`  Seeded ${SEED_POSTS_TAGS} post-tag relations`);
        
        console.log("Database seeding complete.");
        
        return { userIds, postIds, tagIds };
    } finally {
        client.close();
    }
}

