-- Add coalescing columns to notifications
ALTER TABLE "notifications" ADD COLUMN "context_id" text;
ALTER TABLE "notifications" ADD COLUMN "message_count" integer NOT NULL DEFAULT 1;
ALTER TABLE "notifications" ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();

-- Add new_request preference column
ALTER TABLE "notification_preferences" ADD COLUMN "new_request" boolean NOT NULL DEFAULT true;

-- Partial unique index: one notification row per (user, type, session) when context_id is set
CREATE UNIQUE INDEX "notifications_msg_coalesce_idx"
  ON "notifications" ("user_id", "type", "context_id")
  WHERE "context_id" IS NOT NULL;
