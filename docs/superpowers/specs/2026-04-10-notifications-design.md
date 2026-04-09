# Notifications System Design

**Date:** 2026-04-10
**Project:** MakeAbot
**Status:** Approved

---

## Overview

MakeAbot is a campus marketplace for Ateneo students where users post requests and offers, inquire about posts via chat, and leave reviews. The notification system needs to support fast response times (core to the app's value) while avoiding fatigue on a small, contained userbase.

The bidding system has been removed. The interaction model is now: post → inquire (opens a chat thread) → poster closes when done. There are no formal bid accept/reject events.

---

## Delivery Channels

| Channel | Role |
|---|---|
| **Web Push** | Primary channel. OS-level alerts, works when tab is closed. Android/desktop users. |
| **Email** | Transactional for high-value events + daily digest for missed messages. Safety net for users without push permission. |
| **In-app tracker** | Persistent bell icon with full notification history. Primary surface for iOS users who haven't installed the PWA. |

**iOS caveat:** Web Push only works on iOS after the user adds the app to Home Screen (PWA). Show a one-time install banner for Safari iOS users before prompting push permission.

---

## Event & Delivery Matrix

| Event | Push | Email | In-app |
|---|---|---|---|
| New inquiry on your post | ✅ immediate | ✅ immediate | ✅ |
| Active conversation message | ✅ coalesced | ✅ daily digest (if unread) | ✅ coalesced |
| New review | ✅ immediate | ✅ immediate | ✅ |
| New post/request (broadcast) | ✅ immediate, all users | ❌ | ✅ |

---

## Phase-Aware Message Notifications

Chat threads have two phases. The phase determines which notification type fires.

### Phase 1 — Inquiry (first contact)

- Triggered when User X sends the **first message** in a thread to a poster.
- Creates a single in-app notification row: `"X is interested in your [post title]"`.
- If X sends further messages before the poster opens the thread, the existing row is **upserted** (count incremented, body updated: `"X is interested in your post • 3 messages"`). No new push is sent.
- **Gate condition:** Phase 1 ends when the poster opens the thread (marks as read) or sends a reply.

### Phase 2 — Active conversation

- Once the poster has read or replied, the thread graduates to Phase 2.
- From this point, both sides receive standard coalesced message notifications.
- Push uses the Web Push `Topic` header set to `chat_<session_id>` so the OS replaces the existing notification in-place rather than stacking.
- In-app row upserts on `(user_id, context_id)` — one row per thread, count tracked.

### Inquirer's perspective

The Phase 1 gate only applies to the **poster**. When the poster replies, the inquirer immediately receives a standard Phase 2 notification. Both sides are then in Phase 2 for all subsequent messages.

---

## Broadcast Notifications (New Post/Request)

- Fires the moment a new post/request goes live.
- Push sent immediately to **all users except the poster** via `sendPushToAllUsers(excludeUserId, payload)`.
- Uses `Promise.allSettled()` — one stale endpoint must not block others.
- Stale subscriptions (410/404 response) are deleted immediately.
- **In-app row created** for each recipient (grouped under "Opportunities").
- No email — too noisy for a broadcast event.
- No cooldown — intentional latency would reduce the core value of fast response times.

---

## Email Strategy

**Immediate (transactional):**
- New inquiry on your post
- New review

**Daily digest (smart — only sends if unread content exists):**
- Active conversation messages not yet read by the recipient
- Unanswered inquiries (Phase 1 threads the poster hasn't opened)
- Digest is skipped entirely if the user has no unread notification rows of these types
- One email per user per day maximum
- Triggered by a daily cron job

**Never emailed:**
- Broadcast new posts/requests (too noisy)

---

## In-App Tracker

Notification history page grouped by category for scannability:

| Group | Events |
|---|---|
| **Messages** | Inquiries (Phase 1) + active conversation messages (Phase 2) |
| **Reviews** | New review received |
| **Opportunities** | Broadcast new posts/requests |

---

## Database Schema (Drizzle + Postgres)

```sql
-- notifications
id            uuid PK defaultRandom()
user_id       uuid → users.id (cascade delete)
type          text NOT NULL
  -- 'new_inquiry' | 'new_message' | 'new_review' | 'new_request'
context_id    text
  -- chat session ID for new_inquiry/new_message (enables upsert coalescing)
  -- post/request ID for new_request
message_count int NOT NULL DEFAULT 1
title         text NOT NULL
body          text
url           text           -- deep-link target
is_read       boolean NOT NULL DEFAULT false
created_at    timestamp defaultNow()
updated_at    timestamp defaultNow()
UNIQUE (user_id, type, context_id)

-- push_subscriptions
id          uuid PK defaultRandom()
user_id     uuid → users.id (cascade delete)
endpoint    text NOT NULL
p256dh      text NOT NULL
auth        text NOT NULL
created_at  timestamp defaultNow()

-- notification_preferences
user_id        uuid PK → users.id (cascade delete)
new_inquiry    boolean NOT NULL DEFAULT true
new_message    boolean NOT NULL DEFAULT true
new_review     boolean NOT NULL DEFAULT true
new_request    boolean NOT NULL DEFAULT true
```

`notification_preferences` row auto-created on user signup (all true).

---

## Thread Phase State

Thread phase is derived from existing data — no new column needed:

- **Phase 1:** No reply from poster yet AND poster has not read the thread (`is_read = false` on the inquiry notification row).
- **Phase 2:** Poster has replied (`messages` table has a row from the poster) OR `is_read = true` on the inquiry notification.

Phase check lives in `messages.service.ts` before deciding which notification path to take.

---

## New Files

| File | Purpose |
|---|---|
| `public/sw.js` | Handles `push` event (OS notification with Topic coalescing), `notificationclick` (deep-link navigate), silent push when tab focused via `clients.matchAll()` |
| `app/api/push/subscribe/route.ts` | POST saves subscription, DELETE removes it |
| `lib/services/push.service.ts` | `sendPushToUser()`, `sendPushToAllUsers()`: check preferences → write/upsert notifications table → fetch subscriptions → `Promise.allSettled()` send → delete stale |
| `lib/services/email.service.ts` | `sendTransactionalEmail()`, `sendDailyDigest()` via Resend |
| `lib/repo/notifications.repo.ts` | CRUD + upsert for `notifications` table |
| `hooks/use-push-subscription.ts` | Register SW, request permission contextually, POST subscription to API |
| `app/(protected)/notifications/page.tsx` | Notification history grouped by category, mark as read |
| `components/notifications-bell.tsx` | Bell icon with unread count badge in nav |
| `app/(protected)/settings/notifications/page.tsx` | Per-event toggle UI, Server Action updates `notification_preferences` |
| `app/api/cron/daily-digest/route.ts` | Cron endpoint — queries unread message threads per user, sends digest email |

---

## Trigger Points

| Event | File | Notification type | Recipient |
|---|---|---|---|
| First message in thread | `messages.service.ts` | `new_inquiry` | Post owner |
| Follow-up message (Phase 2) | `messages.service.ts` | `new_message` (upsert) | Thread recipient |
| New review | `reviews.service.ts` | `new_review` | Reviewed user |
| New post/request | `requests.service.ts` / `posts.service.ts` | `new_request` | All users except poster |

---

## Cron Job — Daily Digest

- **Schedule:** Once daily (e.g. 8:00 AM local — or UTC if timezone data isn't stored)
- **Logic:**
  1. Query all users with unread `new_message` or `new_inquiry` notification rows
  2. Group threads per user
  3. Send one digest email per user via `sendDailyDigest()`
  4. Do not mark notifications as read — user must open the app
- **Configured in `vercel.ts`** under `crons`

---

## Permission UX

- Do NOT prompt for push permission on page load
- Prompt contextually: after first message sent or first inquiry made
- Show iOS PWA install banner for Safari iOS users before prompting push
- Never re-prompt if permission is already denied — user must fix in browser settings

---

## Operational Rules

- Use `Promise.allSettled()` not `Promise.all()` for multi-subscription sends
- On 410/404 response from push service → delete that subscription row immediately
- Push failures must not throw or block the Server Action (fire-and-forget)
- VAPID keys must not be rotated — doing so invalidates all subscriptions in DB

---

## Environment Variables Required

| Variable | Description |
|---|---|
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | mailto: or app URL |
| `RESEND_API_KEY` | Resend transactional email API key |

---

## Packages Required

- `web-push` + `@types/web-push`
- `resend`

---

## Manual Setup (Cannot Be Automated)

| Step | Where |
|---|---|
| Generate VAPID keys (`npx web-push generate-vapid-keys`) and add to env | Vercel dashboard |
| Create Resend account, verify sending domain via DNS | resend.com + domain registrar |
| Apply RLS policies to `notifications`, `push_subscriptions`, `notification_preferences` | Supabase dashboard |
| Provide PWA icon assets (192×192 and 512×512 PNG) | Designer |
| HTTPS on production | Auto on Vercel |
