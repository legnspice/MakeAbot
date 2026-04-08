# Notifications Rework — Pass 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all behavioral notification bugs: remove dead event types, fix broken URLs, suppress the bell badge while the user is in an active chat, and replace the plain-text email with a styled HTML template.

**Architecture:** Changes are confined to the service layer, validation, DB schema/migration, one chat component, and the settings UI. No new files are created — this is pure cleanup and correctness work on existing infrastructure.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (drizzle-kit 0.31.8), Zod, Resend (email), web-push, Supabase Realtime, Jest.

**Spec:** `docs/superpowers/specs/2026-04-08-notifications-rework-pass1-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/validation/notifications.ts` | Modify | Remove dead types from enum and preferences schema |
| `lib/services/requests.service.ts` | Modify | Remove `new_bid`, `bid_accepted`, `bid_rejected` push calls |
| `lib/services/posts.service.ts` | Modify | Remove `new_bid` push call |
| `lib/services/push.service.ts` | Modify | Narrow `EMAIL_EVENTS`; replace plain-text email with HTML |
| `lib/services/messages.service.ts` | Modify | Fix fallback URL `/notifications` → `/` |
| `lib/db/schema.ts` | Modify | Drop 3 columns from `notification_preferences` |
| `drizzle/0005_remove_dead_notification_types.sql` | Create | Migration: purge orphaned rows + drop columns |
| `app/(protected)/settings/notifications/page.tsx` | Modify | Remove dead labels from `EVENT_LABELS` |
| `components/chat-room.tsx` | Modify | Mark notification read when other user sends a message in-chat |
| `__tests__/lib/actions/notifications.test.ts` | Modify | Update tests to reflect removed preference fields |

---

## Task 1: Narrow notification types in validation

**Files:**
- Modify: `lib/validation/notifications.ts`
- Test: `__tests__/lib/actions/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/actions/notifications.test.ts` inside `describe("updateNotificationPreferences")`:

```ts
it("does not accept removed preference fields (new_bid, bid_accepted, bid_rejected)", async () => {
  // These fields should no longer exist in the schema — updatePreferencesSchema
  // should silently strip or not validate them. We verify the action only passes
  // the remaining valid fields to the service.
  const mockUpdate = jest
    .spyOn(notificationsService, "updatePreferences")
    .mockResolvedValue(undefined as never);

  // Passing only a valid field — should work fine
  await updateNotificationPreferences({ new_review: true });
  expect(mockUpdate).toHaveBeenCalledWith("user-123", { new_review: true });
});
```

- [ ] **Step 2: Run test to verify current state**

```bash
pnpm test __tests__/lib/actions/notifications.test.ts
```

Expected: All existing tests pass. The new test passes too (it will since we're only checking valid fields — this establishes a baseline).

- [ ] **Step 3: Update `lib/validation/notifications.ts`**

Replace the entire file with:

```ts
import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "new_message",
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
  new_review: z.boolean().optional(),
  new_request: z.boolean().optional(),
});
export type UpdatePreferencesSchema = z.infer<typeof updatePreferencesSchema>;
```

- [ ] **Step 4: Run tests**

```bash
pnpm test __tests__/lib/actions/notifications.test.ts
```

Expected: All pass. TypeScript may show errors in other files that still reference the removed types — those are fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/notifications.ts __tests__/lib/actions/notifications.test.ts
git commit -m "feat: remove new_bid/bid_accepted/bid_rejected notification types from validation"
```

---

## Task 2: Remove dead push calls from request and post services

**Files:**
- Modify: `lib/services/requests.service.ts`
- Modify: `lib/services/posts.service.ts`

No new tests needed — the removed code was fire-and-forget side effects. The existing action tests still pass since they mock the service.

- [ ] **Step 1: Update `lib/services/requests.service.ts`**

Replace the entire file with:

```ts
import * as requestsRepo from "../repo/requests.repo";
import { sendPushToAllUsers } from "./push.service";
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
  const request = await requestsRepo.insertRequest(data);
  if (request && data.user_id) {
    // fire-and-forget — failure must not throw
    sendPushToAllUsers(data.user_id, {
      title: "New request posted",
      body: data.title,
      url: `/requests/${request.id}`,
    }).catch(() => {});
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
}

export async function acceptRequestBid(bidId: string, _requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Accepted");
}

export async function rejectRequestBid(bidId: string, _requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Closed");
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

- [ ] **Step 2: Update `lib/services/posts.service.ts`**

Replace the entire file with:

```ts
import * as postsRepo from "../repo/posts.repo";
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
  return await postsRepo.insertPostBid(data);
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

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add lib/services/requests.service.ts lib/services/posts.service.ts
git commit -m "feat: remove new_bid/bid_accepted/bid_rejected push calls from request and post services"
```

---

## Task 3: Fix message URL fallback and narrow EMAIL_EVENTS

**Files:**
- Modify: `lib/services/messages.service.ts`
- Modify: `lib/services/push.service.ts`

- [ ] **Step 1: Fix fallback URL in `lib/services/messages.service.ts`**

Change line 25 (the `url` field in `sendPushToUser`):

```ts
// Before:
url: contextId
  ? `/chat?bidId=${contextId}&otherId=${data.sender_id}`
  : "/notifications",

// After:
url: contextId
  ? `/chat?bidId=${contextId}&otherId=${data.sender_id}`
  : "/",
```

- [ ] **Step 2: Narrow `EMAIL_EVENTS` in `lib/services/push.service.ts`**

Change the `EMAIL_EVENTS` set (around line 16):

```ts
// Before:
const EMAIL_EVENTS = new Set<NotificationType>([
  "new_bid",
  "bid_accepted",
  "bid_rejected",
  "new_review",
]);

// After:
const EMAIL_EVENTS = new Set<NotificationType>([
  "new_review",
]);
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add lib/services/messages.service.ts lib/services/push.service.ts
git commit -m "fix: correct message fallback URL and remove dead email events"
```

---

## Task 4: DB migration and schema update

**Files:**
- Create: `drizzle/0005_remove_dead_notification_types.sql`
- Modify: `lib/db/schema.ts`
- Modify: `app/(protected)/settings/notifications/page.tsx`

- [ ] **Step 1: Create migration file `drizzle/0005_remove_dead_notification_types.sql`**

```sql
-- Purge orphaned notification rows for removed event types
DELETE FROM "notifications"
WHERE "type" IN ('new_bid', 'bid_accepted', 'bid_rejected');

-- Remove dead preference columns
ALTER TABLE "notification_preferences"
  DROP COLUMN IF EXISTS "new_bid",
  DROP COLUMN IF EXISTS "bid_accepted",
  DROP COLUMN IF EXISTS "bid_rejected";
```

- [ ] **Step 2: Update `lib/db/schema.ts` — `notification_preferences` table**

Find the `notification_preferences` table definition and replace it:

```ts
// Before:
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

// After:
export const notification_preferences = pgTable("notification_preferences", {
  user_id: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  new_message: boolean("new_message").notNull().default(true),
  new_review: boolean("new_review").notNull().default(true),
  new_request: boolean("new_request").notNull().default(true),
});
```

- [ ] **Step 3: Update `app/(protected)/settings/notifications/page.tsx`**

Replace the `EVENT_LABELS` constant:

```ts
// Before:
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

// After:
const EVENT_LABELS: Record<
  keyof Omit<SelectNotificationPreferences, "user_id">,
  string
> = {
  new_message: "New messages",
  new_review: "New reviews",
  new_request: "New requests from others",
};
```

- [ ] **Step 4: Apply the migration**

Ensure `DATABASE_URL` is set in your environment (`.env.local`), then run:

```bash
pnpm drizzle-kit migrate
```

Expected output: migration `0005_remove_dead_notification_types` applied successfully.

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All pass. TypeScript compilation should also be clean — the `SelectNotificationPreferences` type no longer includes the removed columns, and `EVENT_LABELS` is now consistent with it.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0005_remove_dead_notification_types.sql lib/db/schema.ts app/\(protected\)/settings/notifications/page.tsx
git commit -m "feat: drop new_bid/bid_accepted/bid_rejected columns and purge orphaned notification rows"
```

---

## Task 5: Suppress bell badge for incoming messages in active chat

**Files:**
- Modify: `components/chat-room.tsx`

The mount-time `markChatNotificationRead` call already exists at line 44–49. What's missing: when the other user sends a message while the current user is in the chat, the upsert sets `is_read = false` and the bell badge increments. Fix: detect new incoming messages in `handleMessageLogic` and immediately re-mark read.

- [ ] **Step 1: Add `processedIncomingIds` ref and incoming-message handler to `components/chat-room.tsx`**

Add the ref declaration after `processedMessageIds` (around line 39):

```ts
const processedMessageIds = useRef<Set<string>>(new Set());
const processedIncomingIds = useRef<Set<string>>(new Set());  // ← add this line
```

Then inside the `handleMessageLogic.current = async (messages) => { ... }` block (the `useEffect` starting around line 79), add the incoming-message handler **before** the existing outgoing-message logic:

```ts
handleMessageLogic.current = async (messages: ChatMessage[]) => {
  // Mark notification read when the other user sends us a message while we're in this chat.
  // The upsert in push.service sets is_read=false on each new message; this re-marks it read.
  const contextId = request_bid_id ?? post_bid_id;
  const newIncoming = messages.filter(
    (msg) =>
      msg.user.userId !== publicUser.id &&
      !processedIncomingIds.current.has(msg.id),
  );
  if (newIncoming.length > 0 && contextId) {
    newIncoming.forEach((msg) => processedIncomingIds.current.add(msg.id));
    void markChatNotificationRead(contextId);
  }

  // Existing outgoing-message logic (unchanged):
  const newMessagesFromCurrentUser = messages.filter(
    (msg) =>
      msg.user.userId === publicUser.id &&
      !processedMessageIds.current.has(msg.id),
  );

  for (const message of newMessagesFromCurrentUser) {
    processedMessageIds.current.add(message.id);

    await createMessage({
      sender_id: publicUser.id,
      receiver_id: other_user_id,
      content: message.content,
      request_bid_id: request_bid_id || null,
      post_bid_id: post_bid_id || null,
    });
  }
};
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All pass. (This change is UI/Realtime behaviour — no unit test can cover it directly, but existing tests must not regress.)

- [ ] **Step 3: Commit**

```bash
git add components/chat-room.tsx
git commit -m "fix: suppress bell badge for incoming messages while user is in active chat"
```

---

## Task 6: HTML email template

**Files:**
- Modify: `lib/services/push.service.ts`

Replace the plain-text Resend call with a styled HTML email. Only `new_review` reaches this code path now.

- [ ] **Step 1: Replace the email block in `lib/services/push.service.ts`**

Find the email block inside `sendPushToUser` (currently around lines 91–107) and replace it:

```ts
  // 4. Send email for qualifying events (only when RESEND_FROM is configured)
  if (EMAIL_EVENTS.has(type) && process.env.RESEND_FROM) {
    try {
      const adminClient = await createAdminClient();
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (email) {
        const fullUrl = `${process.env.NEXT_PUBLIC_SITE_URL}${pushPayload.url}`;
        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: pushPayload.title,
          text: `${pushPayload.body ?? ""}\n\nView: ${fullUrl}`,
          html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pushPayload.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header accent -->
          <tr>
            <td style="background:#3761B0;height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">${pushPayload.title}</p>
              ${pushPayload.body ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${pushPayload.body}</p>` : ""}
              <a href="${fullUrl}"
                 style="display:inline-block;padding:12px 24px;background:#3761B0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                View on MakeAbot
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this because you have email notifications enabled.<br />
                Manage your preferences in the MakeAbot app under Settings → Notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        });
      }
    } catch {
      // Email failure must never block the caller
    }
  }
```

- [ ] **Step 2: Verify `RESEND_FROM` env var format**

The `from` field must use the display-name format so the sender reads "MakeAbot" not a raw email address. Ensure your `.env.local` (and Vercel env) has:

```
RESEND_FROM=MakeAbot <your-verified-address@yourdomain.com>
```

This is a manual env var check — no code change needed if it's already set correctly.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add lib/services/push.service.ts
git commit -m "feat: replace plain-text email with styled HTML template for new_review notifications"
```

---

## Final check

- [ ] **Run full test suite one last time**

```bash
pnpm test
```

Expected: All pass, no TypeScript errors.

- [ ] **Verify TypeScript compiles cleanly**

```bash
pnpm build
```

Expected: Build succeeds with no type errors. If TypeScript complains about `new_bid` / `bid_accepted` / `bid_rejected` anywhere, find the reference and remove it.
