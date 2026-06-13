-- Add guild_bot_settings table for per-guild bot appearance configuration
-- bio is stored per-guild; avatar is applied live via Discord API

CREATE TABLE IF NOT EXISTS "guild_bot_settings" (
    "guild_id" text PRIMARY KEY NOT NULL REFERENCES "guilds"("guild_id") ON DELETE CASCADE,
    "bio" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
