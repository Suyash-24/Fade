CREATE TABLE "lastfm_users" (
    "user_id"    text PRIMARY KEY NOT NULL,
    "username"   text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
