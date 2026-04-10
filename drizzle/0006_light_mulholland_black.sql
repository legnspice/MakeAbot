ALTER TABLE "messages" DROP CONSTRAINT "messages_request_bid_id_request_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_post_bid_id_post_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_request_bid_id_request_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_post_bid_id_post_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "new_inquiry" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "new_request" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "context_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "message_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_bid_id_request_bids_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."request_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_post_bid_id_post_bids_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."post_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_bid_id_request_bids_id_fk" FOREIGN KEY ("request_bid_id") REFERENCES "public"."request_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_post_bid_id_post_bids_id_fk" FOREIGN KEY ("post_bid_id") REFERENCES "public"."post_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_msg_coalesce_idx" ON "notifications" USING btree ("user_id","type","context_id") WHERE "notifications"."context_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "new_bid";--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "bid_accepted";--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP COLUMN "bid_rejected";