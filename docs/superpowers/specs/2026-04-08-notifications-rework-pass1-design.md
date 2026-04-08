# Notifications Rework — Pass 1: Behavior Fixes

**Date:** 2026-04-08
**Scope:** Service/repo/action/email layer only. Panel UI rework (tabs, read collapsing) is Pass 2, deferred.

---

## Background

The notification system has working infrastructure (DB tables, push service, Resend email, service worker, coalescing via upsert), but several behavioral bugs and UX issues exist:

- `new_bid`, `bid_accepted`, `bid_rejected` notification types fire when they shouldn't or not at all (tied to a bid acceptance flow being removed in a future lifecycle rework)
- Notification URLs point to `/notifications` — a route that doesn't exist (it's a panel, not a page)
- The bell badge increments for new messages even when the user is actively in the relevant chat
- Email is plain text, from an unclear sender, with no styling or CTA

---

## Changes

### 1. Remove `new_bid`, `bid_accepted`, `bid_rejected` notification types

These events are redundant (the first message in a chat already notifies the recipient) and are tied to an accept/reject flow being removed in the upcoming lifecycle rework.

**`lib/validation/notifications.ts`**
Remove `new_bid`, `bid_accepted`, `bid_rejected` from the `NotificationType` enum/union. Remaining types: `new_message`, `new_review`, `new_request`.

**`lib/services/requests.service.ts`**
- `createRequestBid`: delete the `sendPushToUser(..., "new_bid", ...)` fire-and-forget block entirely
- `acceptRequestBid`: delete the `sendPushToUser(..., "bid_accepted", ...)` block entirely
- `rejectRequestBid`: delete the `sendPushToUser(..., "bid_rejected", ...)` block entirely

**`lib/services/posts.service.ts`**
- `createPostBid`: delete the `sendPushToUser(..., "new_bid", ...)` call entirely

**`lib/services/push.service.ts`**
- Remove `new_bid`, `bid_accepted`, `bid_rejected` from the `EMAIL_EVENTS` set

**`lib/db/schema.ts` + Drizzle migration**
- Drop `new_bid`, `bid_accepted`, `bid_rejected` boolean columns from `notification_preferences` table
- Include a one-time `DELETE FROM notifications WHERE type IN ('new_bid', 'bid_accepted', 'bid_rejected')` in the migration to purge orphaned rows already in the DB

---

### 2. Fix notification URLs

**`lib/services/messages.service.ts`**
The fallback URL when `contextId` is null was `"/notifications"` (a dead route). Change to `"/"`. In practice every chat has a `bidId`, so this path is rarely hit.

All other dead `/notifications` URLs were in `rejectRequestBid` — removed in change 1 above.

---

### 3. Preserve: message coalescing per chat session (already implemented, must not be broken)

Each chat session produces exactly one `notifications` row, not one per message. This is enforced by an upsert in `lib/repo/notifications.repo.ts:upsertMessageNotification` — on conflict `(user_id, type, context_id)` it increments `message_count` and updates `body`/`title` rather than inserting a new row. `push.service.ts` calls this path for `new_message` type. No changes needed here — implementors must not replace this with a plain `insertNotification` call.

### 4. Suppress bell badge while user is in an active chat

The service worker already suppresses the OS push popup when the user is on the relevant chat page. The in-app badge still increments because the upsert sets `is_read = false` and Realtime fires an UPDATE.

**Fix:** Call `markChatNotificationRead(contextId)` in the chat page in two places:
1. On mount — clears any pre-existing unread notification for this session
2. On every incoming Realtime message — immediately re-marks the notification read after the upsert sets it to false

`markChatNotificationRead` is already implemented in `lib/actions/notifications.ts` and `lib/services/notifications.service.ts`. The chat page only needs to call it at the right times.

**Affected file:** The chat page component (wherever the Realtime message subscription lives — to be confirmed during implementation).

---

### 5. Fix email templates

**`lib/services/push.service.ts`**

Replace the plain-text `resend.emails.send` call with an HTML email. Only `new_review` sends email now (since `new_bid`/`bid_accepted`/`bid_rejected` are removed; `new_message` was already excluded from `EMAIL_EVENTS`).

Requirements:
- `from`: display name "MakeAbot" via Resend `from` field format: `"MakeAbot <resend-address@yourdomain.com>"` — use `RESEND_FROM` env var, which should be set to this format
- `subject`: the notification title (already being used)
- `html` body:
  - Clean layout: white background, centered container (max 600px)
  - Brand color `#3761B0` for the CTA button and header accent
  - Greeting: "Hi there,"
  - Body text: the notification body string
  - CTA button: "View on MakeAbot" linking to `${NEXT_PUBLIC_SITE_URL}${url}`
  - Footer: "You're receiving this because you have email notifications enabled. Manage your preferences in app."
- Keep `text` fallback for email clients that don't render HTML (already present)

No logo/image assets required.

---

## Out of scope (Pass 2)

- Notifications panel tab UI (All / Messages / Activity)
- Read notification collapsing (dimmed below unread, collapsible after threshold)
- `/notifications` route removal (no route exists today — already a panel)

---

## Files changed summary

| File | Change |
|---|---|
| `lib/validation/notifications.ts` | Remove 3 dead notification types |
| `lib/services/requests.service.ts` | Remove all 3 notification calls |
| `lib/services/posts.service.ts` | Remove `new_bid` call |
| `lib/services/push.service.ts` | Remove from EMAIL_EVENTS; HTML email template |
| `lib/services/messages.service.ts` | Fix fallback URL `/notifications` → `/` |
| `lib/db/schema.ts` | Drop 3 columns from `notification_preferences` |
| Drizzle migration file | Schema migration for column removal |
| Chat page component | Call `markChatNotificationRead` on mount + on message |
