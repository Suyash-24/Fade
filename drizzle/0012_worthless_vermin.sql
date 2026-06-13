-- Remove old channelId column from birthdays (was per-entry, now guild-level)
ALTER TABLE "birthdays" DROP COLUMN IF EXISTS "channel_id";

CREATE INDEX IF NOT EXISTS "birthdays_guild_user_idx" ON "birthdays" USING btree ("guild_id", "user_id");

CREATE TABLE IF NOT EXISTS "birthday_config" (
    "guild_id"   text PRIMARY KEY NOT NULL,
    "channel_id" text,
    "role_id"    text,
    "message"    text,
    "enabled"    boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "birthday_config" ADD CONSTRAINT "birthday_config_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
