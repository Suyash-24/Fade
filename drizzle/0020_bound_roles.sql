CREATE TABLE IF NOT EXISTS "bound_roles" (
	"guild_id" text NOT NULL,
	"role_id" text NOT NULL,
	"type" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bound_roles_guild_id_role_id_type_pk" PRIMARY KEY("guild_id","role_id","type")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bound_roles" ADD CONSTRAINT "bound_roles_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "economy_shop" ALTER COLUMN "stock" SET DEFAULT -1;
