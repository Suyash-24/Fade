import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function run() {
    try {
        await sql`
        CREATE TABLE IF NOT EXISTS "scrapbook_config" (
            "guild_id" text PRIMARY KEY NOT NULL,
            "channel_id" text NOT NULL,
            "enabled" boolean DEFAULT false NOT NULL
        );
        `;
        console.log('Created scrapbook_config');

        await sql`
        CREATE TABLE IF NOT EXISTS "scrapbook_messages" (
            "id" serial PRIMARY KEY NOT NULL,
            "guild_id" text NOT NULL,
            "message_id" text NOT NULL,
            "author_id" text NOT NULL,
            "content" text NOT NULL,
            "reaction_count" integer DEFAULT 0 NOT NULL,
            "comedy_count" integer DEFAULT 0 NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
        );
        `;
        console.log('Created scrapbook_messages');

        await sql`
        CREATE TABLE IF NOT EXISTS "scrapbook_users" (
            "guild_id" text NOT NULL,
            "user_id" text NOT NULL,
            "message_count" integer DEFAULT 0 NOT NULL,
            "voice_seconds" integer DEFAULT 0 NOT NULL,
            CONSTRAINT "scrapbook_users_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
        );
        `;
        console.log('Created scrapbook_users');

        await sql`
        ALTER TABLE "scrapbook_config" ADD CONSTRAINT "scrapbook_config_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
        `.catch(e => console.log('FK config already exists'));

        await sql`
        ALTER TABLE "scrapbook_messages" ADD CONSTRAINT "scrapbook_messages_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
        `.catch(e => console.log('FK msg already exists'));

        await sql`
        ALTER TABLE "scrapbook_users" ADD CONSTRAINT "scrapbook_users_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
        `.catch(e => console.log('FK user already exists'));

        await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "scrapbook_msg_unique_idx" ON "scrapbook_messages" USING btree ("guild_id","message_id");
        `.catch(e => console.log('Index msg already exists'));

        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
