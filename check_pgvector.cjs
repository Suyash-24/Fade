require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function check() {
    try {
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log('pgvector supported');
    } catch(e) {
        console.log('No pgvector:', e.message);
    } finally {
        await sql.end();
    }
}
check();
