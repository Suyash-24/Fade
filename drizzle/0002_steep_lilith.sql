CREATE TABLE "booster_role_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"base_role_id" text,
	"award_role_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booster_role_config" ADD CONSTRAINT "booster_role_config_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;