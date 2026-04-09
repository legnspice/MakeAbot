-- Purge orphaned notification rows for removed event types
DELETE FROM "notifications"
WHERE "type" IN ('new_bid', 'bid_accepted', 'bid_rejected');

-- Remove dead preference columns
ALTER TABLE "notification_preferences"
  DROP COLUMN IF EXISTS "new_bid",
  DROP COLUMN IF EXISTS "bid_accepted",
  DROP COLUMN IF EXISTS "bid_rejected";
