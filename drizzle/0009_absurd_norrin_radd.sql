CREATE TABLE "invoke_messages" (
    "id"         serial PRIMARY KEY NOT NULL,
    "guild_id"   text NOT NULL,
    "command"    varchar(20) NOT NULL,
    "message"    text,
    "dm_message" text
);

CREATE INDEX "invoke_messages_guild_cmd_idx" ON "invoke_messages" USING btree ("guild_id", "command");

ALTER TABLE "invoke_messages" ADD CONSTRAINT "invoke_messages_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
