-- Vanity roles redesign: drop old single-role table, create config + multi-role tables
DROP TABLE IF EXISTS "vanity_roles";

CREATE TABLE "vanity_config" (
    "guild_id" text PRIMARY KEY NOT NULL,
    "keyword"  text NOT NULL,
    "channel_id" text,
    "message"  text,
    "enabled"  boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "vanity_roles" (
    "id"       serial PRIMARY KEY NOT NULL,
    "guild_id" text NOT NULL,
    "role_id"  text NOT NULL
);

ALTER TABLE "vanity_config" ADD CONSTRAINT "vanity_config_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "vanity_roles" ADD CONSTRAINT "vanity_roles_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
