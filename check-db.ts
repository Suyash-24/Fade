import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function main() {
    const r = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('warn_thresholds', 'polls', 'confession_config', 'confessions', 'hardbans')
        ORDER BY table_name
    `;
    console.log('\n=== NEW TABLES IN DATABASE ===');
    if (r.length === 0) {
        console.log('NONE FOUND - migrations may not have run!');
    } else {
        r.forEach(row => console.log('  OK: ' + row.table_name));
    }

    const cols = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'warn_thresholds'
        ORDER BY ordinal_position
    `;
    console.log('\n=== warn_thresholds COLUMNS ===');
    cols.forEach(col => console.log('  ' + col.column_name + ': ' + col.data_type));

    process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
