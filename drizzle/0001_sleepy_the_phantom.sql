CREATE TYPE "public"."type" AS ENUM('Item', 'Service', 'Unknown');--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_request_bid_id_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_post_bid_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "type" SET DEFAULT 'Unknown'::"public"."type";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "type" SET DATA TYPE "public"."type" USING "type"::"public"."type";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "type" "type" DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_bid_id_request_bids_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."request_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_post_bid_id_post_bids_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."post_bids"("id") ON DELETE no action ON UPDATE no action;