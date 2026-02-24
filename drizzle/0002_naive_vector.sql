CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rated_user_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"request_bid_id" uuid,
	"post_bid_id" uuid,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rating" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "fee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "request_bids" ADD COLUMN "status" text DEFAULT 'Pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "id_number" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "contributions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rated_user_id_users_id_fk" FOREIGN KEY ("rated_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_bid_id_requests_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_post_bid_id_posts_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_bid_id_requests_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_post_bid_id_posts_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;