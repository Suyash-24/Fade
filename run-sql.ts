import fs from 'fs';
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
    try {
        const query = fs.readFileSync('drizzle/0019_analytics.sql', 'utf8');
        await sql.unsafe(query);
        console.log("SQL executed successfully!");
    } catch (e) {
        console.error("SQL failed:", e);
    } finally {
        await sql.end();
    }
}
main();
