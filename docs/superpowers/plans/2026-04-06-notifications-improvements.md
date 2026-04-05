# Notifications Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing notification system with per-session message coalescing, broadcast push for new requests, silent push when chat is focused, and a grouped notifications panel.

**Architecture:** Message notifications upsert on `(user_id, type, context_id)` instead of inserting per message — combined with Web Push `Topic`/`tag` headers this collapses N pushes into one per chat session. New requests fire a broadcast push to all users (push-only, no in-app row). The service worker skips OS notifications when the user is already on the relevant chat page.

**Tech Stack:** Drizzle ORM 0.45 (onConflictDoUpdate + partial unique index), web-push 3.x (Topic header), Next.js 16 Server Actions, Supabase Realtime (bell badge already wired).

---

## File Map

| File | Change |
|------|--------|
| `lib/db/schema.ts` | Add `context_id`, `message_count`, `updated_at` to `notifications`; add `new_request` to `notification_preferences`; add partial unique index |
| `drizzle/0004_notifications_coalesce.sql` | Create — migration SQL to run in Supabase |
| `lib/validation/notifications.ts` | Add `new_request` type; add `context_id` to insert schema; add `new_request` to update prefs schema |
| `lib/repo/notifications.repo.ts` | Add `upsertMessageNotification()`; add `findSubscriptionsForBroadcast()` |
| `lib/services/push.service.ts` | Update `sendPushToUser` for coalescing; add `sendPushToAllUsers()` |
| `lib/services/messages.service.ts` | Pass `contextId` when calling `sendPushToUser` |
| `lib/repo/requests.repo.ts` | Update `insertRequest` to return the inserted row |
| `lib/services/requests.service.ts` | Broadcast push in `createRequest` |
| `public/sw.js` | Add `tag` to showNotification; add silent push check for focused chat tab |
| `components/ui/notifications-panel.tsx` | Group notifications by category (Messages / Activity) |
| `app/(protected)/settings/notifications/page.tsx` | Add `new_request` toggle |

---

## Task 1: DB Schema + Migration

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `drizzle/0004_notifications_coalesce.sql`

- [ ] **Step 1: Write the migration SQL file**

Create `drizzle/0004_notifications_coalesce.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run this SQL in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

- [ ] **Step 3: Update schema.ts**

Replace the `notifications` and `notification_preferences` table definitions in `lib/db/schema.ts`:

```typescript
import {
  integer,
  pgTable,
  pgSchema,
  text,
  uuid,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// ... existing imports ...
```

Replace the `notifications` table:

```typescript
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    context_id: text("context_id"),
    message_count: integer("message_count").notNull().default(1),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    is_read: boolean("is_read").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_msg_coalesce_idx")
      .on(t.user_id, t.type, t.context_id)
      .where(sql`${t.context_id} IS NOT NULL`),
  ],
);
```

Replace the `notification_preferences` table:

```typescript
export const notification_preferences = pgTable("notification_preferences", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  new_message: boolean("new_message").notNull().default(true),
  new_bid: boolean("new_bid").notNull().default(true),
  bid_accepted: boolean("bid_accepted").notNull().default(true),
  bid_rejected: boolean("bid_rejected").notNull().default(true),
  new_review: boolean("new_review").notNull().default(true),
  new_request: boolean("new_request").notNull().default(true),
});
```

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle/0004_notifications_coalesce.sql
git commit -m "feat: add coalescing columns and new_request preference to notifications schema"
```

---

## Task 2: Update Validation

**Files:**
- Modify: `lib/validation/notifications.ts`

- [ ] **Step 1: Update the file**

Replace the entire file:

```typescript
import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "new_message",
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
  "new_request",
] as const;

export const NotificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const insertNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: NotificationTypeEnum,
  context_id: z.string().optional(),
  title: z.string().min(1),
  body: z.string().optional(),
  url: z.string().optional(),
});
export type InsertNotificationSchema = z.infer<typeof insertNotificationSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
export type PushSubscriptionSchema = z.infer<typeof pushSubscriptionSchema>;

export const updatePreferencesSchema = z.object({
  new_message: z.boolean().optional(),
  new_bid: z.boolean().optional(),
  bid_accepted: z.boolean().optional(),
  bid_rejected: z.boolean().optional(),
  new_review: z.boolean().optional(),
  new_request: z.boolean().optional(),
});
export type UpdatePreferencesSchema = z.infer<typeof updatePreferencesSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/validation/notifications.ts
git commit -m "feat: add new_request type and context_id to notification validation schemas"
```

---

## Task 3: Update Notifications Repo

**Files:**
- Modify: `lib/repo/notifications.repo.ts`

- [ ] **Step 1: Add imports and new functions**

Add `sql`, `ne`, `or`, `isNull` to the drizzle-orm imports at the top:

```typescript
import { eq, desc, and, count, sql, ne, or, isNull } from "drizzle-orm";
```

Replace the `insertNotification` function with `upsertMessageNotification` and keep `insertNotification` for non-message types:

```typescript
export async function insertNotification(data: InsertNotificationSchema) {
  const [row] = await db.insert(notifications).values(data).returning();
  return row;
}

export async function upsertMessageNotification(data: InsertNotificationSchema & { context_id: string }) {
  const [row] = await db
    .insert(notifications)
    .values({ ...data, message_count: 1 })
    .onConflictDoUpdate({
      target: [notifications.user_id, notifications.type, notifications.context_id],
      targetWhere: sql`${notifications.context_id} IS NOT NULL`,
      set: {
        message_count: sql`${notifications.message_count} + 1`,
        body: sql`excluded.body`,
        title: sql`excluded.title`,
        is_read: false,
        updated_at: sql`now()`,
      },
    })
    .returning();
  return row;
}
```

Add `findSubscriptionsForBroadcast` after the existing subscription functions:

```typescript
export async function findSubscriptionsForBroadcast(excludeUserId: string) {
  return await db
    .select({
      id: push_subscriptions.id,
      endpoint: push_subscriptions.endpoint,
      p256dh: push_subscriptions.p256dh,
      auth: push_subscriptions.auth,
    })
    .from(push_subscriptions)
    .leftJoin(
      notification_preferences,
      eq(push_subscriptions.user_id, notification_preferences.user_id),
    )
    .where(
      and(
        ne(push_subscriptions.user_id, excludeUserId),
        or(
          isNull(notification_preferences.user_id),
          eq(notification_preferences.new_request, true),
        ),
      ),
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/repo/notifications.repo.ts
git commit -m "feat: add upsertMessageNotification and findSubscriptionsForBroadcast to notifications repo"
```

---

## Task 4: Update Push Service

**Files:**
- Modify: `lib/services/push.service.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import webpush from "web-push";
import { Resend } from "resend";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { NotificationType } from "../validation/notifications";

const resend = new Resend(process.env.RESEND_API_KEY!);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.PUBLIC_VAPID_KEY!,
  process.env.PRIVATE_VAPID_KEY!,
);

const EMAIL_EVENTS = new Set<NotificationType>([
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
]);

async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: { title: string; body: string; url: string; tag?: string },
) {
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          payload.tag ? { TTL: 3600, topic: payload.tag } : { TTL: 3600 },
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await notificationsRepo.deleteSubscriptionById(sub.id);
        }
      }
    }),
  );
}

export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url: string; contextId?: string | null },
): Promise<void> {
  const { contextId, ...pushPayload } = payload;

  // 1. Write to in-app tracker
  try {
    if (type === "new_message" && contextId) {
      await notificationsRepo.upsertMessageNotification({
        user_id: userId,
        type,
        context_id: contextId,
        title: pushPayload.title,
        body: pushPayload.body,
        url: pushPayload.url,
      });
    } else {
      await notificationsRepo.insertNotification({
        user_id: userId,
        type,
        title: pushPayload.title,
        body: pushPayload.body,
        url: pushPayload.url,
      });
    }
  } catch {
    // DB failure — in-app tracker unavailable, continue to push/email
  }

  // 2. Check preferences
  const prefs = await notificationsRepo.findPreferences(userId);
  if (prefs && prefs[type as keyof typeof prefs] === false) return;

  // 3. Send Web Push
  const subscriptions = await notificationsRepo.findSubscriptionsForUser(userId);
  if (subscriptions.length > 0) {
    const tag = type === "new_message" && contextId ? `chat_${contextId}` : undefined;
    await sendToSubscriptions(subscriptions, { ...pushPayload, tag });
  }

  // 4. Send email for qualifying events
  if (EMAIL_EVENTS.has(type)) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: pushPayload.title,
          text: `${pushPayload.body ?? ""}\n\nView: ${process.env.NEXT_PUBLIC_SITE_URL}${pushPayload.url}`,
        });
      }
    } catch {
      // Email failure must never block the caller
    }
  }
}

export async function sendPushToAllUsers(
  excludeUserId: string,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  // No in-app row — broadcast push only
  const subscriptions = await notificationsRepo.findSubscriptionsForBroadcast(excludeUserId);
  if (subscriptions.length === 0) return;
  await sendToSubscriptions(subscriptions, payload);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/push.service.ts
git commit -m "feat: add message coalescing (Topic/tag) and sendPushToAllUsers broadcast to push service"
```

---

## Task 5: Update Messages Service

**Files:**
- Modify: `lib/services/messages.service.ts`

- [ ] **Step 1: Update `createMessage`**

Replace the `createMessage` function:

```typescript
export async function createMessage(data: InsertMessageSchema) {
  const result = await messagesRepo.insertMessage(data);
  const contextId = data.request_bid_id ?? data.post_bid_id ?? null;
  // fire-and-forget — failure must not throw
  sendPushToUser(data.receiver_id, "new_message", {
    title: "New message",
    body: data.content.length > 60 ? data.content.slice(0, 60) + "…" : data.content,
    url: contextId
      ? `/chat?bidId=${contextId}&otherId=${data.sender_id}`
      : "/notifications",
    contextId,
  }).catch(() => {});
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/messages.service.ts
git commit -m "feat: pass contextId for per-session message notification coalescing"
```

---

## Task 6: Broadcast on New Request

**Files:**
- Modify: `lib/repo/requests.repo.ts`
- Modify: `lib/services/requests.service.ts`

- [ ] **Step 1: Update `insertRequest` in the repo to return the inserted row**

In `lib/repo/requests.repo.ts`, replace:

```typescript
export async function insertRequest(data: InsertRequestSchema) {
  return await db.insert(requests).values(data);
}
```

With:

```typescript
export async function insertRequest(data: InsertRequestSchema) {
  const [request] = await db.insert(requests).values(data).returning();
  return request;
}
```

- [ ] **Step 2: Add broadcast in `createRequest` in the service**

In `lib/services/requests.service.ts`, add `sendPushToAllUsers` to the import:

```typescript
import { sendPushToUser, sendPushToAllUsers } from "./push.service";
```

Replace `createRequest`:

```typescript
export async function createRequest(data: InsertRequestSchema) {
  const request = await requestsRepo.insertRequest(data);
  if (data.user_id) {
    // fire-and-forget — failure must not throw
    sendPushToAllUsers(data.user_id, {
      title: "New request posted",
      body: data.title,
      url: `/requests/${request.id}`,
    }).catch(() => {});
  }
  return request;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/repo/requests.repo.ts lib/services/requests.service.ts
git commit -m "feat: broadcast push to all users on new request creation"
```

---

## Task 7: Update Service Worker

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Replace the entire file**

```javascript
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "New notification", body: "", url: "/" };
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Silent push: if user is already on the relevant chat page, skip OS notification.
        // The bell badge updates automatically via Supabase Realtime.
        if (data.tag) {
          const bidId = data.tag.replace("chat_", "");
          const isOnChat = windowClients.some(
            (c) => c.focused && c.url.includes(`bidId=${bidId}`),
          );
          if (isOnChat) return;
        }

        return self.registration.showNotification(data.title, {
          body: data.body ?? "",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          tag: data.tag,       // browser collapses notifications with same tag
          renotify: false,     // replace silently — no new sound/vibration
          data: { url: data.url ?? "/" },
        });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: add tag-based notification coalescing and silent push for focused chat tab in service worker"
```

---

## Task 8: Group Notifications Panel by Category

**Files:**
- Modify: `components/ui/notifications-panel.tsx`

- [ ] **Step 1: Replace the render section of the component**

In `components/ui/notifications-panel.tsx`, add a helper and replace the flat list in the scrollable area. Keep all imports and state as-is. Replace only the JSX inside `<div className="flex-1 overflow-y-auto">`:

Add this grouping helper above the component (after imports):

```typescript
type Category = "Messages" | "Activity";

const CATEGORY_MAP: Record<string, Category> = {
  new_message: "Messages",
  new_bid: "Activity",
  bid_accepted: "Activity",
  bid_rejected: "Activity",
  new_review: "Activity",
};

function groupNotifications(items: SelectNotification[]) {
  const groups: Partial<Record<Category, SelectNotification[]>> = {};
  for (const n of items) {
    const cat = CATEGORY_MAP[n.type] ?? "Activity";
    if (!groups[cat]) groups[cat] = [];
    groups[cat]!.push(n);
  }
  // Consistent display order
  const order: Category[] = ["Messages", "Activity"];
  return order.flatMap((cat) =>
    groups[cat]
      ? [{ type: "header" as const, label: cat }, ...groups[cat]!.map((n) => ({ type: "item" as const, n }))]
      : [],
  );
}
```

Replace the content inside `<div className="flex-1 overflow-y-auto">`:

```tsx
{loading ? (
  <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
) : notifications.length === 0 ? (
  <p className="text-center text-gray-400 text-sm pt-10">
    No notifications yet
  </p>
) : (
  <div className="divide-y divide-gray-100">
    {groupNotifications(notifications).map((entry, i) => {
      if (entry.type === "header") {
        return (
          <div key={`header-${entry.label}`} className="px-5 pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {entry.label}
            </p>
          </div>
        );
      }
      const n = entry.n;
      return (
        <button
          key={n.id}
          type="button"
          onClick={() => handleClick(n)}
          className={`w-full text-left px-5 py-4 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
        >
          {!n.is_read && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 mb-0.5" />
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug inline">
            {n.title}
          </p>
          {n.body && (
            <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {formatTime(new Date(n.created_at))}
          </p>
        </button>
      );
    })}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/notifications-panel.tsx
git commit -m "feat: group notifications panel by category (Messages / Activity)"
```

---

## Task 9: Add new_request Toggle to Settings Page

**Files:**
- Modify: `app/(protected)/settings/notifications/page.tsx`

- [ ] **Step 1: Add the new_request label**

In `app/(protected)/settings/notifications/page.tsx`, find the `EVENT_LABELS` constant and add the `new_request` entry:

```typescript
const EVENT_LABELS: Record<
  keyof Omit<SelectNotificationPreferences, "user_id">,
  string
> = {
  new_message: "New messages",
  new_bid: "New bids on your posts/requests",
  bid_accepted: "Your bid was accepted",
  bid_rejected: "Your bid was not accepted",
  new_review: "New reviews",
  new_request: "New requests from others",
};
```

- [ ] **Step 2: Commit**

```bash
git add "app/(protected)/settings/notifications/page.tsx"
git commit -m "feat: add new_request toggle to notification settings page"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Per-session message coalescing (DB upsert) | Task 1, 3, 5 |
| Web Push Topic header (OS-level coalescing) | Task 4 |
| Browser tag-based coalescing | Task 7 |
| Silent push when chat tab focused | Task 7 |
| Broadcast push on new request | Task 4, 6 |
| No in-app row for broadcasts | Task 4 |
| new_request preference column + toggle | Task 1, 2, 9 |
| Notifications panel grouped by category | Task 8 |

## Manual Steps (cannot be automated)

- Apply `drizzle/0004_notifications_coalesce.sql` in **Supabase SQL Editor** (Task 1, Step 2)
- Update **RLS policies** in Supabase dashboard to allow read/write on the new `context_id`, `message_count`, `updated_at` columns (these are on existing rows so existing policies should cover them, but verify)
