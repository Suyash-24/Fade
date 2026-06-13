CREATE TABLE "webhooks" (
    "id"          serial PRIMARY KEY NOT NULL,
    "guild_id"    text NOT NULL,
    "name"        text NOT NULL,
    "channel_id"  text NOT NULL,
    "webhook_id"  text NOT NULL,
    "webhook_url" text NOT NULL,
    "username"    text,
    "avatar_url"  text,
    "created_by"  text NOT NULL,
    "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "webhooks_guild_idx" ON "webhooks" USING btree ("guild_id");

ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
