import 'dotenv/config';
import { db } from '../src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
    await db.execute(sql`DROP TABLE IF EXISTS invite_stats CASCADE;`);
    console.log('Dropped invite_stats');
    process.exit(0);
}

main().catch(console.error);
