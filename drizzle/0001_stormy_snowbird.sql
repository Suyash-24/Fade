CREATE TABLE "antinuke_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"guild_id" text,
	"message" text NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "ban_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "kick_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "channel_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "role_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "webhook_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "vanity_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "ban_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "kick_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "channel_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "role_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "antinuke_config" ADD COLUMN "webhook_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "blacklist" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "spam_punishment" varchar(10) DEFAULT 'mute' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "links_punishment" varchar(10) DEFAULT 'delete' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "invites_punishment" varchar(10) DEFAULT 'delete' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "mentions_punishment" varchar(10) DEFAULT 'delete' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "caps_punishment" varchar(10) DEFAULT 'delete' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "slurs_punishment" varchar(10) DEFAULT 'ban' NOT NULL;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "whitelisted_domains" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "automod_config" ADD COLUMN "spam_per_channel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "goodbye_config" ADD COLUMN "embed_script" text;--> statement-breakpoint
ALTER TABLE "goodbye_config" ADD COLUMN "card_script" text;--> statement-breakpoint
ALTER TABLE "goodbye_config" ADD COLUMN "style" varchar(10) DEFAULT 'embed' NOT NULL;--> statement-breakpoint
ALTER TABLE "goodbye_config" ADD COLUMN "delete_after" integer;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD COLUMN "embed_script" text;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD COLUMN "card_script" text;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD COLUMN "style" varchar(10) DEFAULT 'embed' NOT NULL;--> statement-breakpoint
ALTER TABLE "welcome_config" ADD COLUMN "delete_after" integer;--> statement-breakpoint
ALTER TABLE "antinuke_admins" ADD CONSTRAINT "antinuke_admins_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_remind_at_idx" ON "reminders" USING btree ("remind_at");