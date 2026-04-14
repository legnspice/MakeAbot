ALTER TABLE "post_bids" RENAME TO "offer_bids";--> statement-breakpoint
ALTER TABLE "posts" RENAME TO "offers";--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "post_bid_id" TO "offer_bid_id";--> statement-breakpoint
ALTER TABLE "reviews" RENAME COLUMN "post_bid_id" TO "offer_bid_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_post_bid_id_post_bids_id_fk";
--> statement-breakpoint
ALTER TABLE "offer_bids" DROP CONSTRAINT "post_bids_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "offer_bids" DROP CONSTRAINT "post_bids_bidder_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "offers" DROP CONSTRAINT "posts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_post_bid_id_post_bids_id_fk";
--> statement-breakpoint
UPDATE request_bids SET status = 'Pending' WHERE status = 'Accepted';--> statement-breakpoint
ALTER TABLE "offer_bids" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "offer_bids" ALTER COLUMN "status" SET DEFAULT 'Pending'::text;--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DEFAULT 'Pending'::text;--> statement-breakpoint
DROP TYPE "public"."bid_status";--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('Pending', 'Completed', 'Closed');--> statement-breakpoint
ALTER TABLE "offer_bids" ALTER COLUMN "status" SET DEFAULT 'Pending'::"public"."bid_status";--> statement-breakpoint
ALTER TABLE "offer_bids" ALTER COLUMN "status" SET DATA TYPE "public"."bid_status" USING "status"::"public"."bid_status";--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DEFAULT 'Pending'::"public"."bid_status";--> statement-breakpoint
ALTER TABLE "request_bids" ALTER COLUMN "status" SET DATA TYPE "public"."bid_status" USING "status"::"public"."bid_status";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_offer_bid_id_offer_bids_id_fk" FOREIGN KEY ("offer_bid_id") REFERENCES "public"."offer_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_bids" ADD CONSTRAINT "offer_bids_post_id_offers_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_bids" ADD CONSTRAINT "offer_bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_offer_bid_id_offer_bids_id_fk" FOREIGN KEY ("offer_bid_id") REFERENCES "public"."offer_bids"("id") ON DELETE cascade ON UPDATE no action;