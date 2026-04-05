# Live Notifications — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

---

## Overview

Replace the current computed/derived notification approach with a DB-backed notification system supporting three delivery channels: in-app tracker (always written), Web Push (contextual permission), and email (high-value events only). The existing panel and page UI surfaces are preserved; their data source is replaced.

---

## Architecture

Three layers:

1. **Write layer** — service files call `sendPushToUser()` fire-and-forget after their DB insert. That function writes to the `notifications` table, checks user preferences, then dispatches push and email where applicable.
2. **Read layer** — the existing `NotificationsPanel` and `/notifications` page become readers of the `notifications` table. Mark-as-read is a simple UPDATE on the row.
3. **Live badge** — a `NotificationsBell` client component in the nav subscribes to the `notifications` table via Supabase Realtime, counting `is_read = false` rows in real time.

Push failures are fire-and-forget — they must never throw or block the calling Server Action.

---

## Database

Three new tables (Drizzle schema + migration).

### `notifications`
```
id          uuid PK defaultRandom()
user_id     uuid → users.id ON DELETE CASCADE
type        text NOT NULL  -- 'new_message' | 'new_bid' | 'bid_accepted' | 'bid_rejected' | 'new_review'
title       text NOT NULL
body        text
url         text           -- deep-link target
is_read     boolean NOT NULL DEFAULT false
created_at  timestamp defaultNow()
```

### `push_subscriptions`
```
id          uuid PK defaultRandom()
user_id     uuid → users.id ON DELETE CASCADE
endpoint    text NOT NULL
p256dh      text NOT NULL
auth        text NOT NULL
created_at  timestamp defaultNow()
```

### `notification_preferences`
```
user_id        uuid PK → users.id ON DELETE CASCADE
new_message    boolean NOT NULL DEFAULT true
new_bid        boolean NOT NULL DEFAULT true
bid_accepted   boolean NOT NULL DEFAULT true
bid_rejected   boolean NOT NULL DEFAULT true
new_review     boolean NOT NULL DEFAULT true
```

A `notification_preferences` row is auto-created (all `true`) when a user signs up.

---

## Delivery Matrix

| Event | In-app | Push | Email |
|---|---|---|---|
| New message | ✅ | ✅ | ❌ too noisy |
| New bid received | ✅ | ✅ | ✅ |
| Bid accepted/rejected | ✅ | ✅ | ✅ |
| New review | ✅ | ✅ | ✅ |

Writing to `notifications` is unconditional. Push and email respect `notification_preferences`.

---

## New Files

### `public/sw.js`
Service worker. Handles `push` event (parse payload, show OS notification via `showNotification`) and `notificationclick` event (close notification, open/focus app at `event.notification.data.url`).

### `app/api/push/subscribe/route.ts`
- `POST` — save `{ endpoint, p256dh, auth }` to `push_subscriptions` for the authenticated user
- `DELETE` — remove subscription row by endpoint

### `lib/repo/notifications.repo.ts`
CRUD for the `notifications` table:
- `getNotificationsForUser(userId)` — fetch all rows, newest first
- `getUnreadCountForUser(userId)` — count `is_read = false`
- `markAsRead(notificationId, userId)` — UPDATE `is_read = true`
- `markAllAsRead(userId)` — UPDATE all unread rows for user
- `insertNotification(data)` — INSERT one row, return inserted row

### `lib/services/push.service.ts`
Core function: `sendPushToUser(userId, type, payload: { title, body, url })`.

Steps:
1. Insert row into `notifications` (unconditional)
2. Fetch `notification_preferences` for user — if the event type is disabled, stop here
3. Fetch all `push_subscriptions` for user
4. Send push to each subscription via `web-push` using `Promise.allSettled()`
5. For any subscription that returns 410 or 404, delete that row immediately
6. If event type warrants email (not `new_message`), call Resend with the student's email

### `hooks/use-push-subscription.ts`
Client hook:
- Registers the service worker (`/sw.js`) on mount
- Exposes `requestPermissionAndSubscribe()` — checks current permission state, prompts if `'default'`, never prompts if `'denied'`
- On grant, subscribes via `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: PUBLIC_VAPID_KEY })` and POSTs to `/api/push/subscribe`
- Exposes `unsubscribe()` — calls DELETE on the subscribe API

### `components/notifications-bell.tsx`
Client component replacing the "Notifications" button in the navbar and the Bell icon in the bottom nav.
- On mount, fetches initial unread count from `notifications` repo
- Subscribes to Supabase Realtime on the `notifications` table filtered by `user_id = currentUser.id`
- On INSERT event (new notification), increments local count
- On UPDATE event (mark read), re-fetches count
- Renders a bell icon with a red badge showing count (hidden when 0)
- Clicking navigates to `/notifications` (mobile) or opens the panel (desktop)

### `app/(protected)/settings/notifications/page.tsx`
Per-event toggle UI. Reads current `notification_preferences` row, renders a toggle per event type. A Server Action updates the row on toggle.

---

## Modified Files

### `app/(public)/notifications/page.tsx` → move to `app/(protected)/notifications/page.tsx`
Rewrite data fetching: call `getNotificationsForUser(currentUser.id)` from the repo instead of computing from raw posts/requests/messages. Add "mark all as read" button. Remove all the waterfall fetches.

### `components/ui/notifications-panel.tsx`
Same rewrite as the page — read from `notifications` table. Add mark-as-read on item click (UPDATE `is_read = true` before navigating).

### `components/ui/navbar.tsx`
Swap the `<button>Notifications</button>` for `<NotificationsBell />`.

### `components/ui/bottomnavbar.tsx`
Wrap the Bell icon in `<NotificationsBell />` so the badge appears on mobile too.

### `lib/services/messages.service.ts`
After inserting a message: `sendPushToUser(receiverId, 'new_message', { title, body, url })`.

### `lib/services/requests.service.ts`
- After inserting a bid on a request: `sendPushToUser(request.userId, 'new_bid', ...)`
- After accepting/rejecting a bid: `sendPushToUser(bid.bidderId, 'bid_accepted' | 'bid_rejected', ...)`

### `lib/services/posts.service.ts`
After inserting a bid on a post: `sendPushToUser(post.userId, 'new_bid', ...)`.

### `lib/services/reviews.service.ts`
After inserting a review: `sendPushToUser(review.ratedUserId, 'new_review', ...)`.

---

## Permission UX

- Never prompt on page load
- Prompt contextually: after the user sends their first message or places their first bid
- `use-push-subscription` hook's `requestPermissionAndSubscribe()` is called at those moments
- If permission is `'denied'`, never prompt again — user must change in browser settings
- iOS Safari: Web Push only works from Home Screen (PWA). Show a one-time install banner to iOS Safari users before calling `requestPermissionAndSubscribe()`

---

## Email (Resend)

Emails sent for: `new_bid`, `bid_accepted`, `bid_rejected`, `new_review`.  
From address: configured via `RESEND_FROM` env var (e.g. `notifications@makeabot.com`).  
Template: simple plain-text transactional email with the notification `title`, `body`, and a link to `url`.

---

## Environment Variables

| Variable | Where | Notes |
|---|---|---|
| `PUBLIC_VAPID_KEY` | `.env` + Vercel | Already set |
| `PRIVATE_VAPID_KEY` | `.env` + Vercel | Already set |
| `VAPID_SUBJECT` | `.env` + Vercel | Add manually |
| `RESEND_API_KEY` | `.env` + Vercel | Add manually |
| `RESEND_FROM` | `.env` + Vercel | e.g. `notifications@makeabot.com` or Resend default |

---

## RLS Policies (apply in Supabase dashboard after migration)

```sql
-- notifications
CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions
CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- notification_preferences
CREATE POLICY "users_own_notification_preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
```

Enable RLS on all three tables first:
```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
```

---

## Critical Implementation Rules

- `push.service.ts` uses `Promise.allSettled()`, never `Promise.all()` when sending to multiple subscriptions
- Delete subscription row immediately on 410 or 404 response from push service
- Push/email failures must never throw or block the calling Server Action — wrap in try/catch, log and continue
- Writing to `notifications` table is unconditional — push and email respect preferences, the in-app tracker does not
- Never rotate VAPID keys — doing so invalidates all subscriptions in DB
