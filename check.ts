import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
    try {
        const res = await sql`SELECT "id", "guild_id", "role_id" FROM "vanity_roles" "vanityRoles" WHERE "vanityRoles"."guild_id" = '1220979355057000488'`;
        console.log("Query result:", res);
    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}

main();
