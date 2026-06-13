ALTER TABLE "antinuke_config" ADD COLUMN IF NOT EXISTS "emoji_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "antinuke_config" ADD COLUMN IF NOT EXISTS "emoji_threshold" integer DEFAULT 5 NOT NULL;
ALTER TABLE "antinuke_config" ADD COLUMN IF NOT EXISTS "emoji_punishment" varchar(10) DEFAULT 'ban' NOT NULL;
