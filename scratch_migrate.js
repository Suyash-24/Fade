import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
    try {
        await sql`DROP TABLE IF EXISTS vanity_config CASCADE;`;
        await sql`DROP TABLE IF EXISTS vanity_roles CASCADE;`;

        await sql`
            CREATE TABLE vanity_config (
                guild_id VARCHAR(255) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
                keyword TEXT NOT NULL,
                channel_id VARCHAR(255),
                message TEXT,
                enabled BOOLEAN NOT NULL DEFAULT true,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `;
        console.log('Created vanity_config');

        await sql`
            CREATE TABLE IF NOT EXISTS vanity_roles (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(255) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
                role_id VARCHAR(255) NOT NULL
            );
        `;
        console.log('Created vanity_roles');

        await sql`
            ALTER TABLE scrapbook_users 
            ADD COLUMN IF NOT EXISTS night_owl_count INTEGER NOT NULL DEFAULT 0;
        `;
        console.log('Added night_owl_count to scrapbook_users');

        console.log('Done!');
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}
run();
