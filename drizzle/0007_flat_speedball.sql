-- Starboard new columns
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "self_star" boolean DEFAULT false NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "show_timestamp" boolean DEFAULT true NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "show_jump_url" boolean DEFAULT true NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "show_attachments" boolean DEFAULT true NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "color" integer;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "clown_channel_id" text;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "clown_emoji" text DEFAULT '🤡' NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "clown_threshold" integer DEFAULT 3 NOT NULL;
ALTER TABLE "starboard_config" ADD COLUMN IF NOT EXISTS "clown_enabled" boolean DEFAULT false NOT NULL;

-- Giveaway new columns
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "required_roles" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "max_level" integer DEFAULT 0 NOT NULL;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "thumbnail" text;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "image" text;
