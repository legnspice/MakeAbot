ALTER TABLE "messages" DROP CONSTRAINT "messages_request_bid_id_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_post_bid_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "status" SET DATA TYPE "public"."post_status";--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "status" SET DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DATA TYPE "public"."bid_status";--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DEFAULT 'Pending';--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "urgency" SET DATA TYPE "public"."urgency";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "urgency" SET DEFAULT 'Now';--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "status" SET DATA TYPE "public"."request_status";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "status" SET DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_bid_id_request_bids_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."request_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_post_bid_id_post_bids_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."post_bids"("id") ON DELETE no action ON UPDATE no action;