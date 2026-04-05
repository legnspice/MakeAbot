# Live Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the computed notification approach with a DB-backed three-channel notification system (in-app tracker, Web Push, email) wired into all relevant service triggers.

**Architecture:** A central `sendPushToUser()` function in `push.service.ts` is called fire-and-forget from service files after DB writes. It unconditionally writes to the `notifications` table, then checks `notification_preferences` before dispatching Web Push (via `web-push`) and email (via Resend). The nav badge subscribes to the `notifications` table via Supabase Realtime postgres_changes.

**Tech Stack:** Drizzle ORM, `web-push`, Resend, Supabase Realtime (postgres_changes), Next.js App Router Server Actions, Jest

---

## File Map

**Create:**
- `lib/validation/notifications.ts` — Zod schemas for notifications, prefs, and subscriptions
- `lib/repo/notifications.repo.ts` — CRUD for all three new tables
- `lib/services/push.service.ts` — `sendPushToUser()` core dispatch function
- `app/api/push/subscribe/route.ts` — POST/DELETE push subscription endpoint
- `public/sw.js` — Service worker: receive push, show OS notification, handle click
- `hooks/use-push-subscription.ts` — SW registration + contextual permission prompt
- `components/notifications-bell.tsx` — Realtime unread badge for nav
- `app/(protected)/notifications/page.tsx` — Notification history page (replaces `(public)` version)
- `app/(protected)/settings/notifications/page.tsx` — Per-event preference toggles
- `lib/services/notifications.service.ts` — Thin service wrapper over notifications repo
- `lib/actions/notifications.ts` — Server Actions: get notifications, mark read, get/update prefs
- `__tests__/lib/actions/notifications.test.ts` — Tests for notification actions

**Modify:**
- `lib/db/schema.ts` — Add `notifications`, `push_subscriptions`, `notification_preferences` tables
- `lib/repo/posts.repo.ts` — Add `findPostById`, change `insertPostBid` to use `.returning()`
- `lib/repo/requests.repo.ts` — Add `findRequestById`, change `insertRequestBid` to use `.returning()`, add `updateRequestBidStatus`
- `lib/services/users.service.ts` — Auto-create `notification_preferences` row on signup
- `lib/services/messages.service.ts` — Fire `sendPushToUser` after message insert
- `lib/services/posts.service.ts` — Fire `sendPushToUser` after post bid insert
- `lib/services/requests.service.ts` — Fire `sendPushToUser` after request bid insert/status update
- `lib/services/reviews.service.ts` — Fire `sendPushToUser` after review insert
- `components/ui/navbar.tsx` — Replace Notifications button with `<NotificationsBell />`
- `components/ui/bottomnavbar.tsx` — Add unread badge to Bell nav item
- `components/ui/notifications-panel.tsx` — Read from `notifications` table, add mark-as-read
- `app/(public)/notifications/page.tsx` — **Delete** (replaced by `(protected)` version)

---

## Task 1: Install packages

**Files:** none (package changes only)

- [ ] **Step 1: Install web-push, its types, and Resend**

```bash
npm install web-push resend
npm install --save-dev @types/web-push
```

Expected: no errors, `package.json` now includes `"web-push"` and `"resend"`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add web-push and resend packages"
```

---

## Task 2: DB schema additions + migration

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add the three new tables to `lib/db/schema.ts`**

Add after the existing `post_bids` table and before the `export type` lines:

```typescript
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  url: text("url"),
  is_read: boolean("is_read").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const push_subscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const notification_preferences = pgTable("notification_preferences", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  new_message: boolean("new_message").notNull().default(true),
  new_bid: boolean("new_bid").notNull().default(true),
  bid_accepted: boolean("bid_accepted").notNull().default(true),
  bid_rejected: boolean("bid_rejected").notNull().default(true),
  new_review: boolean("new_review").notNull().default(true),
});
```

Also add inferred types at the bottom of the file:

```typescript
export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;
export type InsertPushSubscription = typeof push_subscriptions.$inferInsert;
export type SelectPushSubscription = typeof push_subscriptions.$inferSelect;
export type SelectNotificationPreferences = typeof notification_preferences.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

```bash
npx drizzle-kit generate
```

Expected: a new `.sql` file appears in `./drizzle/` (e.g. `0002_notifications.sql`) containing `CREATE TABLE` statements for all three tables.

- [ ] **Step 3: Apply the migration**

```bash
npx drizzle-kit migrate
```

Expected: `All migrations applied successfully.`

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat: add notifications, push_subscriptions, notification_preferences tables"
```

---

## Task 3: Notification validation schemas

**Files:**
- Create: `lib/validation/notifications.ts`

- [ ] **Step 1: Create the file**

```typescript
import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "new_message",
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
] as const;

export const NotificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const insertNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: NotificationTypeEnum,
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
});
export type UpdatePreferencesSchema = z.infer<typeof updatePreferencesSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add lib/validation/notifications.ts
git commit -m "feat: add notification validation schemas"
```

---

## Task 4: Notifications repo

**Files:**
- Create: `lib/repo/notifications.repo.ts`

- [ ] **Step 1: Create the file**

```typescript
import { eq, desc, and, count } from "drizzle-orm";
import { db } from "../db";
import {
  notifications,
  push_subscriptions,
  notification_preferences,
} from "../db/schema";
import { InsertNotificationSchema } from "../validation/notifications";

// --- Notifications ---

export async function findNotificationsForUser(userId: string) {
  return await db.query.notifications.findMany({
    where: eq(notifications.user_id, userId),
    orderBy: [desc(notifications.created_at)],
  });
}

export async function countUnreadForUser(userId: string) {
  const result = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
  return result[0]?.value ?? 0;
}

export async function insertNotification(data: InsertNotificationSchema) {
  const [row] = await db.insert(notifications).values(data).returning();
  return row;
}

export async function markNotificationRead(id: string, userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
}

export async function markAllNotificationsRead(userId: string) {
  return await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
}

// --- Push Subscriptions ---

export async function findSubscriptionsForUser(userId: string) {
  return await db.query.push_subscriptions.findMany({
    where: eq(push_subscriptions.user_id, userId),
  });
}

export async function insertSubscription(data: {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return await db
    .insert(push_subscriptions)
    .values(data)
    .onConflictDoNothing();
}

export async function deleteSubscriptionById(id: string) {
  return await db.delete(push_subscriptions).where(eq(push_subscriptions.id, id));
}

export async function deleteSubscriptionByEndpoint(userId: string, endpoint: string) {
  return await db
    .delete(push_subscriptions)
    .where(
      and(eq(push_subscriptions.user_id, userId), eq(push_subscriptions.endpoint, endpoint))
    );
}

// --- Notification Preferences ---

export async function findPreferences(userId: string) {
  return await db.query.notification_preferences.findFirst({
    where: eq(notification_preferences.user_id, userId),
  });
}

export async function insertDefaultPreferences(userId: string) {
  return await db
    .insert(notification_preferences)
    .values({ user_id: userId })
    .onConflictDoNothing();
}

export async function updatePreferences(
  userId: string,
  data: Partial<Omit<typeof notification_preferences.$inferInsert, "user_id">>
) {
  return await db
    .update(notification_preferences)
    .set(data)
    .where(eq(notification_preferences.user_id, userId));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/repo/notifications.repo.ts
git commit -m "feat: add notifications repo (CRUD for notifications, subscriptions, prefs)"
```

---

## Task 5: Push service

**Files:**
- Create: `lib/services/push.service.ts`

- [ ] **Step 1: Create the file**

```typescript
import webpush from "web-push";
import { Resend } from "resend";
import * as notificationsRepo from "../repo/notifications.repo";
import { createAdminClient } from "../supabase/admin";
import { NotificationType } from "../validation/notifications";

const resend = new Resend(process.env.RESEND_API_KEY!);

const EMAIL_EVENTS = new Set<NotificationType>([
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
]);

export async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  // 1. Always write to in-app tracker (unconditional)
  await notificationsRepo.insertNotification({
    user_id: userId,
    type,
    title: payload.title,
    body: payload.body,
    url: payload.url,
  });

  // 2. Check preferences — if this event type is disabled, stop here
  const prefs = await notificationsRepo.findPreferences(userId);
  if (prefs && !prefs[type as keyof typeof prefs]) return;

  // 3. Send Web Push to all registered devices
  const subscriptions = await notificationsRepo.findSubscriptionsForUser(userId);
  if (subscriptions.length > 0) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.PUBLIC_VAPID_KEY!,
      process.env.PRIVATE_VAPID_KEY!,
    );
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ title: payload.title, body: payload.body, url: payload.url })
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            // Stale subscription — delete immediately
            await notificationsRepo.deleteSubscriptionById(sub.id);
          }
        }
      })
    );
  }

  // 4. Send email for qualifying event types
  if (EMAIL_EVENTS.has(type)) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: payload.title,
          text: `${payload.body ?? ""}\n\nView: ${process.env.NEXT_PUBLIC_SITE_URL}${payload.url}`,
        });
      }
    } catch {
      // Email failure must never block the caller
    }
  }
}
```

- [ ] **Step 2: Add `RESEND_FROM` to `.env`**

Open `.env` and add:

```
RESEND_FROM=notifications@yourdomain.com
```

(Use your verified Resend domain, or `onboarding@resend.dev` for testing on their shared domain.)

Also add `RESEND_FROM` to your Vercel dashboard under Environment Variables.

- [ ] **Step 3: Commit**

```bash
git add lib/services/push.service.ts .env
git commit -m "feat: add push.service with sendPushToUser (in-app + web push + email)"
```

---

## Task 6: Auto-create notification_preferences on signup

**Files:**
- Modify: `lib/services/users.service.ts`
- Modify: `lib/repo/users.repo.ts`

- [ ] **Step 1: Update `lib/services/users.service.ts`**

Replace the existing `createUser` function:

```typescript
import * as usersRepo from "../repo/users.repo";
import * as notificationsRepo from "../repo/notifications.repo";
import { FindUserSchema, UpdateUserSchema } from "../validation/users";

export async function getUsers(filters: FindUserSchema) {
  return await usersRepo.findUsers(filters);
}

export async function createUser(id: string) {
  await usersRepo.insertUser(id);
  await notificationsRepo.insertDefaultPreferences(id);
}

export async function editUser(id: string, data: UpdateUserSchema) {
  return await usersRepo.updateUser(id, data);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/users.service.ts
git commit -m "feat: auto-create notification_preferences row on user signup"
```

---

## Task 7: Add `findPostById`, `findRequestById`, update insert functions to return IDs

**Files:**
- Modify: `lib/repo/posts.repo.ts`
- Modify: `lib/repo/requests.repo.ts`

- [ ] **Step 1: Update `lib/repo/posts.repo.ts`**

Add `findPostById` at the top of the file (after imports) and update `insertPostBid` to use `.returning()`:

```typescript
export async function findPostById(id: string) {
  return await db.query.posts.findFirst({
    where: eq(posts.id, id),
  });
}
```

Change `insertPostBid`:

```typescript
export async function insertPostBid(data: InsertPostBidSchema) {
  const [bid] = await db.insert(post_bids).values(data).returning();
  return bid;
}
```

- [ ] **Step 2: Update `lib/repo/requests.repo.ts`**

Add `findRequestById` and `updateRequestBidStatus`, and update `insertRequestBid` to use `.returning()`:

```typescript
export async function findRequestById(id: string) {
  return await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
}

export async function findRequestBidById(id: string) {
  return await db.query.request_bids.findFirst({
    where: eq(request_bids.id, id),
  });
}
```

Change `insertRequestBid`:

```typescript
export async function insertRequestBid(data: InsertRequestBidSchema) {
  const [bid] = await db.insert(request_bids).values(data).returning();
  return bid;
}
```

Add `updateRequestBidStatus` at the end:

```typescript
export async function updateRequestBidStatus(
  bidId: string,
  status: "Accepted" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(eq(request_bids.id, bidId));
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/repo/posts.repo.ts lib/repo/requests.repo.ts
git commit -m "feat: add findPostById, findRequestById, returning() on bid inserts"
```

---

## Task 8: Wire notification triggers into existing services

**Files:**
- Modify: `lib/services/messages.service.ts`
- Modify: `lib/services/posts.service.ts`
- Modify: `lib/services/requests.service.ts`
- Modify: `lib/services/reviews.service.ts`

- [ ] **Step 1: Update `lib/services/messages.service.ts`**

```typescript
import * as messagesRepo from "../repo/messages.repo";
import { sendPushToUser } from "./push.service";
import {
  FindMessagesSchema,
  InsertMessageSchema,
  FindConversationSchema,
} from "../validation/messages";

export async function getMessages(filters: FindMessagesSchema) {
  return await messagesRepo.findMessages(filters);
}

export async function getConversation(filters: FindConversationSchema) {
  return await messagesRepo.findConversation(filters);
}

export async function createMessage(data: InsertMessageSchema) {
  const result = await messagesRepo.insertMessage(data);
  // fire-and-forget — failure must not throw
  sendPushToUser(data.receiver_id, "new_message", {
    title: "New message",
    body: data.content.length > 60 ? data.content.slice(0, 60) + "…" : data.content,
    url: "/notifications",
  }).catch(() => {});
  return result;
}

export async function removeMessage(id: string, userId: string) {
  return await messagesRepo.deleteMessage(id, userId);
}
```

- [ ] **Step 2: Update `lib/services/posts.service.ts`**

```typescript
import * as postsRepo from "../repo/posts.repo";
import { sendPushToUser } from "./push.service";
import { posts } from "../db/schema";
import {
  FindPostsSchema,
  FindPostBidsSchema,
  InsertPostBidSchema,
  InsertPostSchema,
  UpdatePostSchema,
} from "../validation/posts";

export async function getPosts(filters: FindPostsSchema) {
  return await postsRepo.findPosts(filters);
}

export async function getPostBids(filters: FindPostBidsSchema) {
  return await postsRepo.findPostBids(filters);
}

export async function createPost(data: InsertPostSchema) {
  return await postsRepo.insertPost(data);
}

export async function createPostBid(data: InsertPostBidSchema) {
  const bid = await postsRepo.insertPostBid(data);
  // fire-and-forget
  (async () => {
    try {
      const post = await postsRepo.findPostById(data.post_id);
      if (post?.user_id) {
        await sendPushToUser(post.user_id, "new_bid", {
          title: `New request for "${post.title}"`,
          body: "Someone wants your offer",
          url: `/chat?bidId=${bid.id}&kind=offer&title=${encodeURIComponent(post.title)}&otherId=${data.bidder_id}`,
        });
      }
    } catch {}
  })();
  return bid;
}

export async function removePost(id: string, userId: string) {
  return await postsRepo.deletePost(id, userId);
}

export async function removePostBid(id: string, userId: string) {
  return await postsRepo.deletePostBid(id, userId);
}

export async function editPost(
  id: string,
  data: UpdatePostSchema,
  userId: string,
) {
  const updatePayload: Partial<typeof posts.$inferInsert> = { ...data };
  if (data.status === "Closed") {
    updatePayload.imgUrl = null;
  }
  return await postsRepo.updatePost(id, updatePayload, userId);
}
```

- [ ] **Step 3: Update `lib/services/requests.service.ts`**

```typescript
import * as requestsRepo from "../repo/requests.repo";
import { sendPushToUser } from "./push.service";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function getRequests(filters: FindRequestsSchema) {
  return await requestsRepo.findRequests(filters);
}

export async function getRequestBids(filters: FindRequestBidsSchema) {
  return await requestsRepo.findRequestBids(filters);
}

export async function createRequest(data: InsertRequestSchema) {
  return await requestsRepo.insertRequest(data);
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  const bid = await requestsRepo.insertRequestBid(data);
  // fire-and-forget
  (async () => {
    try {
      const request = await requestsRepo.findRequestById(data.request_id);
      if (request?.user_id) {
        await sendPushToUser(request.user_id, "new_bid", {
          title: `New offer for "${request.title}"`,
          body: "Someone offered to help",
          url: `/chat?bidId=${bid.id}&kind=request&title=${encodeURIComponent(request.title)}&otherId=${data.bidder_id}`,
        });
      }
    } catch {}
  })();
  return bid;
}

export async function acceptRequestBid(bidId: string, requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Accepted");
  // fire-and-forget
  (async () => {
    try {
      const bid = await requestsRepo.findRequestBidById(bidId);
      if (bid) {
        const request = await requestsRepo.findRequestById(bid.request_id);
        await sendPushToUser(bid.bidder_id, "bid_accepted", {
          title: "Your offer was accepted",
          body: request ? `For "${request.title}"` : "",
          url: `/chat?bidId=${bidId}&kind=request&title=${encodeURIComponent(request?.title ?? "")}&otherId=${requestOwnerId}`,
        });
      }
    } catch {}
  })();
}

export async function rejectRequestBid(bidId: string, requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Closed");
  // fire-and-forget
  (async () => {
    try {
      const bid = await requestsRepo.findRequestBidById(bidId);
      if (bid) {
        const request = await requestsRepo.findRequestById(bid.request_id);
        await sendPushToUser(bid.bidder_id, "bid_rejected", {
          title: "Your offer was not accepted",
          body: request ? `For "${request.title}"` : "",
          url: "/notifications",
        });
      }
    } catch {}
  })();
}

export async function removeRequest(id: string, userId: string) {
  return await requestsRepo.deleteRequest(id, userId);
}

export async function removeRequestBid(id: string, userId: string) {
  return await requestsRepo.deleteRequestBid(id, userId);
}

export async function editRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  return await requestsRepo.updateRequest(id, data, userId);
}
```

- [ ] **Step 4: Update `lib/services/reviews.service.ts`**

```typescript
import * as reviewsRepo from "../repo/reviews.repo";
import { sendPushToUser } from "./push.service";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export async function createReview(data: InsertReviewSchema) {
  const result = await reviewsRepo.insertReview(data);
  // fire-and-forget
  sendPushToUser(data.rated_user_id, "new_review", {
    title: "You received a new review",
    body: data.comment ? data.comment.slice(0, 80) : "",
    url: "/profile",
  }).catch(() => {});
  return result;
}

export async function removeReview(id: string, userId: string) {
  return await reviewsRepo.deleteReview(id, userId);
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/services/messages.service.ts lib/services/posts.service.ts lib/services/requests.service.ts lib/services/reviews.service.ts
git commit -m "feat: wire sendPushToUser triggers into all service event points"
```

---

## Task 9: Notifications Server Actions

**Files:**
- Create: `lib/actions/notifications.ts`
- Create: `__tests__/lib/actions/notifications.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/lib/actions/notifications.test.ts`:

```typescript
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notifications";
import * as notificationsService from "@/lib/services/notifications.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/notifications.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("notifications actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated getNotifications", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
      const result = await getNotifications();
      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("getNotifications", () => {
    it("fetches notifications for the authenticated user", async () => {
      const mockGet = jest
        .spyOn(notificationsService, "getNotificationsForUser")
        .mockResolvedValue([] as never);
      await getNotifications();
      expect(mockGet).toHaveBeenCalledWith("user-123");
    });
  });

  describe("markNotificationRead", () => {
    it("marks a notification read for the authenticated user", async () => {
      const mockMark = jest
        .spyOn(notificationsService, "markRead")
        .mockResolvedValue(undefined as never);
      await markNotificationRead("notif-abc");
      expect(mockMark).toHaveBeenCalledWith("notif-abc", "user-123");
    });
  });

  describe("updateNotificationPreferences", () => {
    it("cannot update preferences for another user — always uses auth user id", async () => {
      const mockUpdate = jest
        .spyOn(notificationsService, "updatePreferences")
        .mockResolvedValue(undefined as never);
      await updateNotificationPreferences({ new_message: false });
      expect(mockUpdate).toHaveBeenCalledWith("user-123", { new_message: false });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/actions/notifications.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/actions/notifications'`

- [ ] **Step 3: Create the notifications service layer**

Create `lib/services/notifications.service.ts`:

```typescript
import * as notificationsRepo from "../repo/notifications.repo";
import { UpdatePreferencesSchema } from "../validation/notifications";

export async function getNotificationsForUser(userId: string) {
  return await notificationsRepo.findNotificationsForUser(userId);
}

export async function getUnreadCount(userId: string) {
  return await notificationsRepo.countUnreadForUser(userId);
}

export async function markRead(notificationId: string, userId: string) {
  return await notificationsRepo.markNotificationRead(notificationId, userId);
}

export async function markAllRead(userId: string) {
  return await notificationsRepo.markAllNotificationsRead(userId);
}

export async function getPreferences(userId: string) {
  return await notificationsRepo.findPreferences(userId);
}

export async function updatePreferences(userId: string, data: UpdatePreferencesSchema) {
  return await notificationsRepo.updatePreferences(userId, data);
}
```

- [ ] **Step 4: Create `lib/actions/notifications.ts`**

```typescript
"use server";

import * as notificationsService from "@/lib/services/notifications.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { UpdatePreferencesSchema } from "@/lib/validation/notifications";

export async function getNotifications() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.getNotificationsForUser(user.id);
  });
}

export async function markNotificationRead(notificationId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.markRead(notificationId, user.id);
  });
}

export async function markAllRead() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.markAllRead(user.id);
  });
}

export async function getNotificationPreferences() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.getPreferences(user.id);
  });
}

export async function updateNotificationPreferences(data: UpdatePreferencesSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return notificationsService.updatePreferences(user.id, data);
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest __tests__/lib/actions/notifications.test.ts --no-coverage
```

Expected: PASS — all 4 tests green

- [ ] **Step 6: Commit**

```bash
git add lib/services/notifications.service.ts lib/actions/notifications.ts __tests__/lib/actions/notifications.test.ts
git commit -m "feat: add notifications service, actions, and tests"
```

---

## Task 10: Push subscribe API route

**Files:**
- Create: `app/api/push/subscribe/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as notificationsRepo from "@/lib/repo/notifications.repo";
import { pushSubscriptionSchema } from "@/lib/validation/notifications";

async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription data" }, { status: 400 });
  }

  await notificationsRepo.insertSubscription({ user_id: userId, ...parsed.data });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await notificationsRepo.deleteSubscriptionByEndpoint(userId, endpoint);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/push/subscribe/route.ts
git commit -m "feat: add push subscribe/unsubscribe API route"
```

---

## Task 11: Service worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Create the file**

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
    self.registration.showNotification(data.title, {
      body: data.body ?? "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url ?? "/" },
    })
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
      })
  );
});
```

- [ ] **Step 2: Create placeholder icons**

Create `public/icons/` directory and add placeholder PNGs (192×192 and 512×512). Replace with final assets when available. For now, create the directory so the SW doesn't 404:

```bash
mkdir -p public/icons
# Add your 192x192 and 512x512 PNG icons as:
# public/icons/icon-192x192.png
# public/icons/icon-512x512.png
```

- [ ] **Step 3: Commit**

```bash
git add public/sw.js public/icons/
git commit -m "feat: add service worker for web push notifications"
```

---

## Task 12: use-push-subscription hook

**Files:**
- Create: `hooks/use-push-subscription.ts`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied") return; // never re-prompt if denied

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      setIsSubscribed(true);
      return;
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });

    setIsSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    setIsSubscribed(false);
  }, []);

  return { permission, isSubscribed, requestPermissionAndSubscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to `.env`**

The hook references `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client-accessible). Add to `.env`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BCXQ6_O1Yje8yh_vPV__9d-yGmeEPMHEGiWj7Iai1ToIsxSWvvdxIhtGG12f1d36MELlqm6U1uJ7YpATzAvMuG8
```

(This is the same value as `PUBLIC_VAPID_KEY` — just needs the `NEXT_PUBLIC_` prefix to be accessible in browser code. Also add to Vercel dashboard.)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-push-subscription.ts .env
git commit -m "feat: add usePushSubscription hook for SW registration and contextual permission prompt"
```

---

## Task 13: NotificationsBell component

**Files:**
- Create: `components/notifications-bell.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

type Props = {
  /** If true, renders as a nav link to /notifications (mobile bottom nav style).
   *  If false, renders as a button that calls onClick (desktop panel style). */
  asLink?: boolean;
  onClick?: () => void;
  /** Extra className for the icon wrapper */
  className?: string;
};

export default function NotificationsBell({ asLink = false, onClick, className = "" }: Props) {
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount((c) => c + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  const badge =
    unreadCount > 0 ? (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  const inner = (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Bell className="w-5 h-5" strokeWidth={2} />
      {badge}
    </span>
  );

  if (asLink) {
    return (
      <Link href="/notifications" aria-label="Notifications">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Notifications"
      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
    >
      {inner}
      <span>Notifications</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/notifications-bell.tsx
git commit -m "feat: add NotificationsBell component with Realtime unread count badge"
```

---

## Task 14: Update navbar and bottom nav

**Files:**
- Modify: `components/ui/navbar.tsx`
- Modify: `components/ui/bottomnavbar.tsx`

- [ ] **Step 1: Update `components/ui/navbar.tsx`**

Replace the import and Notifications button:

Remove:
```typescript
import NotificationsPanel from "@/components/ui/notifications-panel";
```

Add:
```typescript
import NotificationsBell from "@/components/notifications-bell";
```

Replace the desktop Notifications button:
```typescript
// REMOVE this block:
<button
  type="button"
  onClick={() => setNotificationsOpen((v) => !v)}
  className={`flex items-center gap-2 text-sm font-medium transition-colors ${notificationsOpen ? "text-[#3761B0]" : "text-gray-700 hover:text-[#3761B0]"}`}
>
  Notifications
</button>
```

Replace with:
```typescript
<NotificationsBell onClick={() => setNotificationsOpen((v) => !v)} />
```

Keep `notificationsOpen` state and the `<NotificationsPanel>` block as-is — the panel is still used on desktop.

Also remove the `notificationsOpen` check from the button className since `NotificationsBell` handles its own styling. The `useState` for `notificationsOpen` stays because it controls the panel.

- [ ] **Step 2: Update `components/ui/bottomnavbar.tsx`**

The Bell nav item currently uses a plain `<Link>` with `<Bell />`. Wrap it with the `NotificationsBell` component.

Replace the entire `navItems` map content for the notifications item. Change the file to handle the bell specially:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package } from "lucide-react";
import NotificationsBell from "@/components/notifications-bell";

const staticItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/tracker", label: "Tracker", Icon: Package },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#4A6FA5] shadow-lg z-40">
      <div className="flex justify-around items-stretch gap-1 py-2 px-2 min-h-[68px]">
        {staticItems.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 py-2"
            >
              <Icon
                className={`w-6 h-6 transition-colors ${active ? "text-white" : "text-white/60"}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-xs font-medium text-center leading-tight ${active ? "text-white" : "text-white/60"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* Notifications with realtime badge */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1 py-2">
          <NotificationsBell
            asLink
            className={`w-6 h-6 transition-colors ${pathname === "/notifications" ? "text-white" : "text-white/60"}`}
          />
          <span
            className={`text-xs font-medium text-center leading-tight ${pathname === "/notifications" ? "text-white" : "text-white/60"}`}
          >
            Notifications
          </span>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/navbar.tsx components/ui/bottomnavbar.tsx
git commit -m "feat: replace nav notification button/link with NotificationsBell (realtime badge)"
```

---

## Task 15: Rewrite notifications panel

**Files:**
- Modify: `components/ui/notifications-panel.tsx`

- [ ] **Step 1: Rewrite the file**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getNotifications, markNotificationRead, markAllRead } from "@/lib/actions/notifications";
import type { SelectNotification } from "@/lib/db/schema";

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getNotifications();
    setNotifications(result.data ?? []);
    setLoading(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      load();
    }
  }, [open, loaded, load]);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
    }
    if (n.url) {
      router.push(n.url);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-100 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-[#3761B0] hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Close notifications"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">No notifications yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
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
                  {n.body && <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {formatTime(new Date(n.created_at))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/notifications-panel.tsx
git commit -m "feat: rewrite NotificationsPanel to read from notifications table with mark-as-read"
```

---

## Task 16: Replace notifications page

**Files:**
- Delete: `app/(public)/notifications/page.tsx`
- Create: `app/(protected)/notifications/page.tsx`

- [ ] **Step 1: Delete the old page**

```bash
rm app/\(public\)/notifications/page.tsx
```

Verify the `(public)/notifications/` directory is now empty and can be removed if it has no other files:

```bash
rmdir app/\(public\)/notifications/
```

- [ ] **Step 2: Create `app/(protected)/notifications/page.tsx`**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { getNotifications, markNotificationRead, markAllRead } from "@/lib/actions/notifications";
import type { SelectNotification } from "@/lib/db/schema";

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await getNotifications();
    setNotifications(result.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
    }
    if (n.url) router.push(n.url);
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-4 pb-28 md:pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-[#3761B0] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-center text-gray-400 text-sm pt-10">No notifications yet</p>
        ) : (
          <section aria-label="Notifications">
            <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-4 focus:outline-none focus-visible:bg-gray-50 hover:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.is_read && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {n.title}
                        </p>
                      </div>
                      {n.body && (
                        <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 mt-1">
                      {formatTime(new Date(n.created_at))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/notifications/page.tsx
git commit -m "feat: move notifications page to (protected) route group, rewrite to use DB"
```

---

## Task 17: Notification preferences settings page

**Files:**
- Create: `app/(protected)/settings/notifications/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notifications";
import type { SelectNotificationPreferences } from "@/lib/db/schema";

const EVENT_LABELS: Record<
  keyof Omit<SelectNotificationPreferences, "user_id">,
  string
> = {
  new_message: "New messages",
  new_bid: "New bids on your posts/requests",
  bid_accepted: "Your bid was accepted",
  bid_rejected: "Your bid was not accepted",
  new_review: "New reviews",
};

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SelectNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences().then((result) => {
      setPrefs(result.data ?? null);
      setLoading(false);
    });
  }, []);

  async function handleToggle(key: keyof Omit<SelectNotificationPreferences, "user_id">) {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    setSaving(key);
    await updateNotificationPreferences({ [key]: newValue });
    setSaving(null);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h1>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !prefs ? (
          <p className="text-sm text-gray-400">Could not load preferences.</p>
        ) : (
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {(
              Object.keys(EVENT_LABELS) as Array<
                keyof Omit<SelectNotificationPreferences, "user_id">
              >
            ).map((key) => (
              <div key={key} className="flex items-center justify-between px-1 py-4">
                <span className="text-sm text-gray-800">{EVENT_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => handleToggle(key)}
                  disabled={saving === key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] ${
                    prefs[key] ? "bg-[#3761B0]" : "bg-gray-300"
                  } ${saving === key ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      prefs[key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/settings/notifications/page.tsx
git commit -m "feat: add notification preferences settings page with per-event toggles"
```

---

## Post-Implementation: Apply RLS Policies

After all tasks are complete and the migration has run, apply these policies in the **Supabase Dashboard → SQL Editor**:

```sql
-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_notification_preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);
```

---

## Post-Implementation: Wire Contextual Push Prompts

After the above tasks, add the `requestPermissionAndSubscribe()` call to the two trigger points:

1. In the chat component — call `requestPermissionAndSubscribe()` after the first message is sent (on the first successful `createMessage` call).
2. In the bid form component — call `requestPermissionAndSubscribe()` after the first bid is placed (on the first successful `createPostBid` or `createRequestBid` call).

Both use the `usePushSubscription` hook. Only call once per session using a `useRef` guard — e.g., check `hasPrompted.current` before calling and set it to `true` after.
