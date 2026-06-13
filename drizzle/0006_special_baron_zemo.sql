ALTER TABLE "antiraid_config" ADD COLUMN IF NOT EXISTS "lock_on_raid" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "antiraid_whitelist" (
    "id"         serial PRIMARY KEY NOT NULL,
    "guild_id"   text NOT NULL,
    "user_id"    text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "antiraid_whitelist" ADD CONSTRAINT "antiraid_whitelist_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
