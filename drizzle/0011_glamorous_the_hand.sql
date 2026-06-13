-- Update lastfm_users with cache columns
ALTER TABLE "lastfm_users" ADD COLUMN IF NOT EXISTS "cached_artists" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "lastfm_users" ADD COLUMN IF NOT EXISTS "last_cached" timestamp with time zone;

-- Crowns table
CREATE TABLE IF NOT EXISTS "lastfm_crowns" (
    "id"         serial PRIMARY KEY NOT NULL,
    "guild_id"   text NOT NULL,
    "user_id"    text NOT NULL,
    "artist"     text NOT NULL,
    "plays"      integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lastfm_crowns_guild_artist_idx" ON "lastfm_crowns" USING btree ("guild_id", "artist");

ALTER TABLE "lastfm_crowns" ADD CONSTRAINT "lastfm_crowns_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
