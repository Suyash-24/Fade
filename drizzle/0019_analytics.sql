CREATE TABLE IF NOT EXISTS "channel_stats" (
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"date" text NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "channel_stats_guild_id_channel_id_date_pk" PRIMARY KEY("guild_id","channel_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guild_stats" (
	"guild_id" text NOT NULL,
	"date" text NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"joins" integer DEFAULT 0 NOT NULL,
	"leaves" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guild_stats_guild_id_date_pk" PRIMARY KEY("guild_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_stats" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "member_stats_guild_id_user_id_date_pk" PRIMARY KEY("guild_id","user_id","date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "channel_stats" ADD CONSTRAINT "channel_stats_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guild_stats" ADD CONSTRAINT "guild_stats_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_stats" ADD CONSTRAINT "member_stats_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
