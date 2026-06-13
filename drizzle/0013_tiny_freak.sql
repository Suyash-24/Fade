CREATE TABLE "fortnite_shop_config" (
    "guild_id"       text PRIMARY KEY NOT NULL,
    "channel_id"     text NOT NULL,
    "role_id"        text,
    "voting"         boolean DEFAULT false NOT NULL,
    "last_shop_date" text,
    "message_id"     text,
    "updated_at"     timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "fortnite_watches" (
    "id"         serial PRIMARY KEY NOT NULL,
    "user_id"    text NOT NULL,
    "cosmetic"   text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "fortnite_shop_config" ADD CONSTRAINT "fortnite_shop_config_guild_id_guilds_guild_id_fk"
    FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
