import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
    try {
        // Create server_memories table
        await sql`
            CREATE TABLE IF NOT EXISTS server_memories (
                id SERIAL PRIMARY KEY,
                guild_id VARCHAR(255) NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                added_by VARCHAR(255) NOT NULL,
                embedding TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;
        console.log('Created server_memories');

        // Create ai_config table
        await sql`
            CREATE TABLE IF NOT EXISTS ai_config (
                guild_id VARCHAR(255) PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
                enabled BOOLEAN NOT NULL DEFAULT true,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;
        console.log('Created ai_config');

        // Index for fast guild lookups
        await sql`
            CREATE INDEX IF NOT EXISTS idx_server_memories_guild 
            ON server_memories(guild_id);
        `;
        console.log('Created index on server_memories.guild_id');

        console.log('Done! Memory AI tables are ready.');
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}
run();
