CREATE TABLE IF NOT EXISTS "log_ignore" (
    "id"        serial PRIMARY KEY NOT NULL,
    "guild_id"  text NOT NULL,
    "target_id" text NOT NULL,
    "type"      varchar(10) NOT NULL
);

ALTER TABLE "log_ignore" ADD CONSTRAINT "log_ignore_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
