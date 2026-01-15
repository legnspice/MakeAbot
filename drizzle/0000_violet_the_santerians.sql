-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "posts_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "users_table_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone,
	"username" text,
	"full_name" text,
	"avatar_url" text,
	"website" text,
	CONSTRAINT "profiles_username_key" UNIQUE("username"),
	CONSTRAINT "username_length" CHECK (char_length(username) >= 3)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts_table" ADD CONSTRAINT "posts_table_user_id_users_table_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "Users can update own profile." ON "profiles" AS PERMISSIVE FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = id));--> statement-breakpoint
CREATE POLICY "Users can insert their own profile." ON "profiles" AS PERMISSIVE FOR INSERT TO public;--> statement-breakpoint
CREATE POLICY "Public profiles are viewable by everyone." ON "profiles" AS PERMISSIVE FOR SELECT TO public;
*/