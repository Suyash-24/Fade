-- Add exclusive boolean column to reaction_roles and button_roles tables
-- When true, users can only hold one role from that panel at a time.

ALTER TABLE "reaction_roles" ADD COLUMN IF NOT EXISTS "exclusive" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

ALTER TABLE "button_roles" ADD COLUMN IF NOT EXISTS "exclusive" boolean DEFAULT false NOT NULL;
