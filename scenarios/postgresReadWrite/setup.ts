import { Client } from "pg";
import { faker } from "@faker-js/faker";

/**
 * PostgreSQL Read/Write Scenario Setup
 * 
 * Creates tables with PostgreSQL syntax and seeds the database with initial data.
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

async function setupTables(client: Client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS user_posts (
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (post_id) REFERENCES posts (id)
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS posts_tags (
            post_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts (id),
            FOREIGN KEY (tag_id) REFERENCES tags (id)
        )
    `);

    // Create indexes for read queries
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
        CREATE INDEX IF NOT EXISTS idx_user_posts_user_id ON user_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_posts_post_id ON user_posts(post_id);
        CREATE INDEX IF NOT EXISTS idx_posts_tags_post_id ON posts_tags(post_id);
        CREATE INDEX IF NOT EXISTS idx_posts_tags_tag_id ON posts_tags(tag_id);
    `);
}

export async function setup(connectionString: string): Promise<SeedResult> {
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        
        // Create tables
        await setupTables(client);
        
        console.log("Seeding database with initial data...");
        
        const userIds: number[] = [];
        const postIds: number[] = [];
        const tagIds: number[] = [];
        
        // Seed users
        for (let i = 0; i < SEED_USERS; i++) {
            const result = await client.query(
                "INSERT INTO users (name, created_at) VALUES ($1, $2) RETURNING id",
                [faker.person.fullName(), faker.date.past({ years: 2 }).toISOString()]
            );
            userIds.push(Number(result.rows[0]!.id));
        }
        console.log(`  Seeded ${userIds.length} users`);
        
        // Seed tags
        for (let i = 0; i < SEED_TAGS; i++) {
            const result = await client.query(
                "INSERT INTO tags (name) VALUES ($1) RETURNING id",
                [faker.lorem.word()]
            );
            tagIds.push(Number(result.rows[0]!.id));
        }
        console.log(`  Seeded ${tagIds.length} tags`);
        
        // Seed posts
        for (let i = 0; i < SEED_POSTS; i++) {
            const result = await client.query(
                "INSERT INTO posts (title, content, created_at) VALUES ($1, $2, $3) RETURNING id",
                [faker.lorem.sentence(), faker.lorem.paragraphs(2), faker.date.past({ years: 2 }).toISOString()]
            );
            postIds.push(Number(result.rows[0]!.id));
        }
        console.log(`  Seeded ${postIds.length} posts`);
        
        // Seed user_posts relations
        const usedPairs = new Set<string>();
        let inserted = 0;
        while (inserted < SEED_USER_POSTS) {
            const userId = faker.helpers.arrayElement(userIds);
            const postId = faker.helpers.arrayElement(postIds);
            const key = `${userId}-${postId}`;
            if (!usedPairs.has(key)) {
                usedPairs.add(key);
                await client.query(
                    "INSERT INTO user_posts (user_id, post_id) VALUES ($1, $2)",
                    [userId, postId]
                );
                inserted++;
            }
        }
        console.log(`  Seeded ${SEED_USER_POSTS} user-post relations`);
        
        // Seed posts_tags relations
        const usedTagPairs = new Set<string>();
        let tagInserted = 0;
        while (tagInserted < SEED_POSTS_TAGS) {
            const postId = faker.helpers.arrayElement(postIds);
            const tagId = faker.helpers.arrayElement(tagIds);
            const key = `${postId}-${tagId}`;
            if (!usedTagPairs.has(key)) {
                usedTagPairs.add(key);
                await client.query(
                    "INSERT INTO posts_tags (post_id, tag_id) VALUES ($1, $2)",
                    [postId, tagId]
                );
                tagInserted++;
            }
        }
        console.log(`  Seeded ${SEED_POSTS_TAGS} post-tag relations`);
        
        console.log("Database seeding complete.");
        
        return { userIds, postIds, tagIds };
    } finally {
        await client.end();
    }
}

