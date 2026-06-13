-- Economy system: 5 new tables
-- economy_config, economy_wallets, economy_transactions, economy_shop, economy_purchases

CREATE TABLE IF NOT EXISTS "economy_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"currency_name" text DEFAULT 'coins' NOT NULL,
	"currency_emoji" text DEFAULT '🪙' NOT NULL,
	"daily_amount" integer DEFAULT 100 NOT NULL,
	"streak_bonus" boolean DEFAULT true NOT NULL,
	"work_min" integer DEFAULT 20 NOT NULL,
	"work_max" integer DEFAULT 80 NOT NULL,
	"rob_enabled" boolean DEFAULT true NOT NULL,
	"rob_success_rate" integer DEFAULT 40 NOT NULL,
	"rob_min_balance" integer DEFAULT 100 NOT NULL,
	"rob_fail_penalty" integer DEFAULT 50 NOT NULL,
	"max_bet" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "economy_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"bank" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"last_daily" timestamp with time zone,
	"daily_streak" integer DEFAULT 0 NOT NULL,
	"last_work" timestamp with time zone,
	"last_rob" timestamp with time zone,
	"last_gamble" timestamp with time zone,
	"last_slots" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "economy_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "economy_shop" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"type" varchar(20) DEFAULT 'custom' NOT NULL,
	"role_id" text,
	"stock" integer DEFAULT -1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "economy_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_config" ADD CONSTRAINT "economy_config_guild_id_guilds_guild_id_fk"
		FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_wallets" ADD CONSTRAINT "economy_wallets_guild_id_guilds_guild_id_fk"
		FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_transactions" ADD CONSTRAINT "economy_transactions_guild_id_guilds_guild_id_fk"
		FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_shop" ADD CONSTRAINT "economy_shop_guild_id_guilds_guild_id_fk"
		FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_purchases" ADD CONSTRAINT "economy_purchases_guild_id_guilds_guild_id_fk"
		FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "economy_purchases" ADD CONSTRAINT "economy_purchases_item_id_economy_shop_id_fk"
		FOREIGN KEY ("item_id") REFERENCES "public"."economy_shop"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "economy_wallets_guild_idx" ON "economy_wallets" USING btree ("guild_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economy_wallets_guild_user_idx" ON "economy_wallets" USING btree ("guild_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economy_wallets_wealth_idx" ON "economy_wallets" USING btree ("guild_id","balance","bank");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economy_tx_guild_user_idx" ON "economy_transactions" USING btree ("guild_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economy_shop_guild_idx" ON "economy_shop" USING btree ("guild_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economy_purchases_guild_user_idx" ON "economy_purchases" USING btree ("guild_id","user_id");
