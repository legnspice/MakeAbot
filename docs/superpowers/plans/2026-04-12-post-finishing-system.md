# Post Finishing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full deal-finishing lifecycle for offers and requests — including the `posts`→`offers` rename, new finishing actions, tracker History section, ChatListModal finishing, chat page sidebar removal, and completion notifications.

**Architecture:** DB migration first (rename + enum update), then service/repo/action layer rework, then UI changes top-down (tracker → chat). Each task is independently committable. Notifications wired last so they can reference the finalized action signatures.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + drizzle-kit migrations, Supabase Postgres, web-push, Resend, Jest, TypeScript, Tailwind 4, shadcn/ui

---

## File Map

| File | Change |
|---|---|
| `lib/db/enums.ts` | `bid_status`: remove `Accepted`, add `Completed` |
| `lib/db/schema.ts` | Rename `posts`→`offers`, `post_bids`→`offer_bids`; add `offer_bids.status` |
| `lib/validation/offers.ts` | Rename from `posts.ts`; add `BidStatusEnum` import; update `offerBidSchema` with `status` field |
| `lib/repo/offers.repo.ts` | Rename from `posts.repo.ts`; add `closeOfferBids`, `completeOfferBid`, `expireStaleOfferBids` |
| `lib/repo/requests.repo.ts` | Remove `updateRequestBidStatus` signature `Accepted`, update to `Pending\|Completed\|Closed`; add `bulkCloseRequestBids`, `expireStaleRequestBids` |
| `lib/services/offers.service.ts` | Rename from `posts.service.ts`; add `closeOffer`, `completeOfferBid`, `expireStaleOfferBids` |
| `lib/services/requests.service.ts` | Remove `acceptRequestBid`/`rejectRequestBid`; add `completeRequest`, `expireStaleRequestBids` |
| `lib/actions/offers.ts` | Rename from `posts.ts`; add `closeOffer`, `completeOfferBid` |
| `lib/actions/deals.ts` | Remove `acceptDeal`; replace `finishDeal` with `completeRequest`, `completeOfferBid`, `closeOffer`; simplify `getDealStatus` |
| `lib/validation/notifications.ts` | Add `request_completed_winner`, `request_completed_loser`, `offer_bid_completed`, `bid_expired` types |
| `lib/services/push.service.ts` | Add new types to `EMAIL_EVENTS`; update chat deep-link `url` for `new_inquiry`/`new_message` |
| `app/api/cron/expire-bids/route.ts` | New — daily cron, expires stale bids, fires `bid_expired` notifications |
| `vercel.json` | Add `expire-bids` cron at `5 0 * * *` |
| `app/(protected)/tracker/page.tsx` | Close replaces Delete for owned offers; Withdraw for non-owned; History section |
| `app/(protected)/chat/page.tsx` | Full rewrite — remove sidebar/waterfall, single-panel, route guard, Mark done, banners |
| `__tests__/lib/actions/offers.test.ts` | Rename from `posts.test.ts`; update imports |
| `__tests__/lib/actions/deals.test.ts` | New — test `completeRequest`, `completeOfferBid`, `closeOffer` |
| All files importing `posts.*` | Update imports to `offers.*` |
| `components/ui/skeletons/chat-skeleton.tsx` | Delete `ChatSidebarSkeleton` export (or whole file if only export) |

---

### Task 1: DB enum + schema migration

**Files:**
- Modify: `lib/db/enums.ts`
- Modify: `lib/db/schema.ts`

> **Workflow note:** This project uses `npx drizzle-kit push` (not `generate`+`migrate`) for all schema changes. Push directly to Supabase. Data migrations (UPDATE statements) must be run separately via the Supabase dashboard SQL editor.

- [ ] **Step 1: Update `bid_status` enum in `lib/db/enums.ts`**

```typescript
// lib/db/enums.ts — replace BID_STATUS block
export const BID_STATUS_VALUES = ["Pending", "Completed", "Closed"] as const;
export const bidStatusEnum = pgEnum("bid_status", BID_STATUS_VALUES);
export const BidStatusEnum = z.enum(BID_STATUS_VALUES);
export type BidStatus = z.infer<typeof BidStatusEnum>;
```

- [ ] **Step 2: Rename tables and add `offer_bids.status` in `lib/db/schema.ts`**

Replace every occurrence of `posts` → `offers` and `post_bids` → `offer_bids` in the table definitions. Also rename the exported constants. Then add `status` to `offer_bids`:

```typescript
// lib/db/schema.ts

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  imgUrl: text("imgUrl"),
  price: integer("price"),
  title: text("title").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(), // required for expiry logic
  type: typeEnum("type").notNull().default("Unknown"),
  status: postStatusEnum("status").notNull().default("Active"),
});

export const offer_bids = pgTable("offer_bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id")
    .notNull()
    .references(() => offers.id, { onDelete: "cascade" }),
  bidder_id: uuid("bidder_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  status: bidStatusEnum("status").notNull().default("Pending"),
});
```

Also update `messages` and `reviews` tables — rename FK column `post_bid_id` → `offer_bid_id` and update reference to `offer_bids`:

```typescript
// In messages table:
offer_bid_id: uuid("offer_bid_id").references(() => offer_bids.id, {
  onDelete: "cascade",
}),

// In reviews table:
offer_bid_id: uuid("offer_bid_id").references(() => offer_bids.id, {
  onDelete: "cascade",
}),
```

Also add `updated_at` to `requests` table and add type exports:
```typescript
// In requests table:
updated_at: timestamp("updated_at").notNull().defaultNow(),

// At bottom of schema.ts:
export type InsertOfferBid = typeof offer_bids.$inferInsert;
export type SelectOfferBid = typeof offer_bids.$inferSelect;
```

- [ ] **Step 3: Push schema to Supabase**

```bash
npx drizzle-kit push
```

- [ ] **Step 4: Run data migration manually**

In the Supabase dashboard SQL editor, run:

```sql
UPDATE request_bids SET status = 'Pending' WHERE status = 'Accepted';
```

This cleans up any pre-existing rows before the enum value is retired.

- [ ] **Step 5: Commit**

```bash
git add lib/db/enums.ts lib/db/schema.ts
git commit -m "feat: rename posts→offers, add offer_bids.status, rework bid_status enum"
```

---

### Task 2: Rename validation + repo + service files

**Files:**
- Create: `lib/validation/offers.ts` (from `posts.ts`)
- Create: `lib/repo/offers.repo.ts` (from `posts.repo.ts`)
- Create: `lib/services/offers.service.ts` (from `posts.service.ts`)
- Delete: `lib/validation/posts.ts`, `lib/repo/posts.repo.ts`, `lib/services/posts.service.ts`

- [ ] **Step 1: Create `lib/validation/offers.ts`**

```typescript
import { z } from "zod";
import { PostStatusEnum, TypeEnum, BidStatusEnum } from "../db/enums";

export const offerSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  imgUrl: z.string().nullable(),
  price: z.number().int().nonnegative().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.date(),
  type: TypeEnum.optional(),
  status: PostStatusEnum.optional(),
});

export const offerBidSchema = z.object({
  id: z.string().uuid(),
  post_id: z.string().uuid(),
  bidder_id: z.string().uuid(),
  created_at: z.date(),
  status: BidStatusEnum.optional(),
});

export const findOffersSchema = offerSchema
  .pick({ id: true, user_id: true, price: true, title: true, status: true, created_at: true })
  .partial();

export const insertOfferSchema = offerSchema.pick({
  user_id: true, title: true, price: true, description: true, imgUrl: true, status: true, type: true,
});

export const updateOfferSchema = offerSchema
  .pick({ price: true, title: true, description: true, status: true, imgUrl: true, type: true })
  .partial();

export const findOfferBidsSchema = offerBidSchema
  .pick({ id: true, post_id: true, bidder_id: true, created_at: true })
  .partial();

export const insertOfferBidSchema = offerBidSchema.pick({ post_id: true, bidder_id: true });

export type FindOffersSchema = z.infer<typeof findOffersSchema>;
export type InsertOfferSchema = z.infer<typeof insertOfferSchema>;
export type UpdateOfferSchema = z.infer<typeof updateOfferSchema>;
export type FindOfferBidsSchema = z.infer<typeof findOfferBidsSchema>;
export type InsertOfferBidSchema = z.infer<typeof insertOfferBidSchema>;
```

- [ ] **Step 2: Create `lib/repo/offers.repo.ts`**

```typescript
import { and, eq, lte, ilike, gte, desc, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { offers, offer_bids } from "../db/schema";
import { getDayRange } from "./helper";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
} from "../validation/offers";
import { sql } from "drizzle-orm";

export async function findOfferById(id: string) {
  return await db.query.offers.findFirst({ where: eq(offers.id, id) });
}

export async function findOffers(filters: FindOffersSchema) {
  const { id, user_id, price, title, status, created_at } = filters;
  const conditions = [];
  if (id) conditions.push(eq(offers.id, id));
  if (user_id) conditions.push(eq(offers.user_id, user_id));
  if (price) conditions.push(lte(offers.price, price));
  if (status) conditions.push(eq(offers.status, status));
  if (title) conditions.push(ilike(offers.title, `%${title}%`));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(offers.created_at, startOfDay));
    conditions.push(lte(offers.created_at, endOfDay));
  }
  return await db.query.offers.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(offers.created_at)],
  });
}

export async function findOfferBids(filters: FindOfferBidsSchema) {
  const { id, post_id, bidder_id, created_at } = filters;
  const conditions = [];
  if (id) conditions.push(eq(offer_bids.id, id));
  if (post_id) conditions.push(eq(offer_bids.post_id, post_id));
  if (bidder_id) conditions.push(eq(offer_bids.bidder_id, bidder_id));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(offer_bids.created_at, startOfDay));
    conditions.push(lte(offer_bids.created_at, endOfDay));
  }
  return await db.query.offer_bids.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(offer_bids.created_at)],
  });
}

export async function insertOffer(data: InsertOfferSchema) {
  const [offer] = await db.insert(offers).values(data).returning();
  return offer;
}

export async function insertOfferBid(data: InsertOfferBidSchema) {
  const [bid] = await db.insert(offer_bids).values(data).returning();
  return bid;
}

export async function deleteOffer(id: string, userId: string) {
  return await db.delete(offers).where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

export async function deleteOfferBid(id: string, userId: string) {
  return await db.delete(offer_bids).where(and(eq(offer_bids.id, id), eq(offer_bids.bidder_id, userId)));
}

export async function updateOffer(
  id: string,
  data: Partial<typeof offers.$inferInsert>,
  userId: string,
) {
  return await db.update(offers).set(data).where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

/** Set a single offer_bid to Completed */
export async function completeOfferBid(bidId: string) {
  return await db.update(offer_bids).set({ status: "Completed" }).where(eq(offer_bids.id, bidId));
}

/** Set all Pending bids on an offer to Closed */
export async function closeOfferBids(offerId: string) {
  return await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(and(eq(offer_bids.post_id, offerId), eq(offer_bids.status, "Pending")));
}

/** Expire Pending offer_bids where parent offer updated_at < 14 days ago */
export async function expireStaleOfferBids(): Promise<
  { bidId: string; bidderId: string; offerTitle: string }[]
> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({
      bidId: offer_bids.id,
      bidderId: offer_bids.bidder_id,
      offerTitle: offers.title,
    })
    .from(offer_bids)
    .innerJoin(offers, eq(offer_bids.post_id, offers.id))
    .where(
      and(
        eq(offer_bids.status, "Pending"),
        lt(offers.updated_at, cutoff),
      ),
    );

  if (stale.length === 0) return [];

  const staleIds = stale.map((r) => r.bidId);
  await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(and(eq(offer_bids.status, "Pending"), sql`${offer_bids.id} = ANY(${staleIds})`));

  return stale;
}
```

- [ ] **Step 3: Create `lib/services/offers.service.ts`**

```typescript
import * as offersRepo from "../repo/offers.repo";
import { offers } from "../db/schema";
import { sendPushToAllUsers } from "./push.service";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
  UpdateOfferSchema,
} from "../validation/offers";

export async function getOffers(filters: FindOffersSchema) {
  return await offersRepo.findOffers(filters);
}

export async function getOfferBids(filters: FindOfferBidsSchema) {
  return await offersRepo.findOfferBids(filters);
}

export async function createOffer(data: InsertOfferSchema) {
  const offer = await offersRepo.insertOffer(data);
  if (offer && data.user_id) {
    sendPushToAllUsers(data.user_id, {
      title: "New post available",
      body: data.title,
      url: `/`,
    }).catch(() => {});
  }
  return offer;
}

export async function createOfferBid(data: InsertOfferBidSchema) {
  return await offersRepo.insertOfferBid(data);
}

export async function removeOffer(id: string, userId: string) {
  return await offersRepo.deleteOffer(id, userId);
}

export async function removeOfferBid(id: string, userId: string) {
  return await offersRepo.deleteOfferBid(id, userId);
}

export async function editOffer(
  id: string,
  data: UpdateOfferSchema,
  userId: string,
) {
  const updatePayload: Partial<typeof offers.$inferInsert> = { ...data };
  if (data.status === "Closed") {
    updatePayload.imgUrl = null;
  }
  return await offersRepo.updateOffer(id, updatePayload, userId);
}

export async function closeOffer(id: string, userId: string) {
  await offersRepo.updateOffer(id, { status: "Closed", imgUrl: null }, userId);
  await offersRepo.closeOfferBids(id);
}

export async function completeOfferBid(bidId: string) {
  return await offersRepo.completeOfferBid(bidId);
}

export async function expireStaleOfferBids() {
  return await offersRepo.expireStaleOfferBids();
}
```

- [ ] **Step 4: Delete old files**

```bash
rm lib/validation/posts.ts lib/repo/posts.repo.ts lib/services/posts.service.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/validation/offers.ts lib/repo/offers.repo.ts lib/services/offers.service.ts
git add lib/validation/posts.ts lib/repo/posts.repo.ts lib/services/posts.service.ts
git commit -m "feat: rename posts→offers in validation/repo/service layer; add closeOffer, completeOfferBid, expireStaleOfferBids"
```

---

### Task 3: Rework `requests` service/repo — remove accept/reject, add `completeRequest` + `expireStaleRequestBids`

**Files:**
- Modify: `lib/repo/requests.repo.ts`
- Modify: `lib/services/requests.service.ts`

- [ ] **Step 1: Update `lib/repo/requests.repo.ts`**

Replace `updateRequestBidStatus` (which had `"Accepted" | "Closed"`) and add new bulk operations:

```typescript
// Replace updateRequestBidStatus with:
export async function updateRequestBidStatus(
  bidId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(eq(request_bids.id, bidId));
}

/** Set all Pending bids on a request to Closed, except the winner */
export async function bulkCloseRequestBids(requestId: string, exceptBidId: string) {
  return await db
    .update(request_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(request_bids.request_id, requestId),
        eq(request_bids.status, "Pending"),
        ne(request_bids.id, exceptBidId),
      ),
    );
}

/** Find all Pending request_bids whose parent request updated_at < 14 days ago */
export async function expireStaleRequestBids(): Promise<
  { bidId: string; bidderId: string; requestTitle: string }[]
> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({
      bidId: request_bids.id,
      bidderId: request_bids.bidder_id,
      requestTitle: requests.title,
    })
    .from(request_bids)
    .innerJoin(requests, eq(request_bids.request_id, requests.id))
    .where(
      and(
        eq(request_bids.status, "Pending"),
        lt(requests.updated_at, cutoff),
      ),
    );

  if (stale.length === 0) return [];

  const staleIds = stale.map((r) => r.bidId);
  await db
    .update(request_bids)
    .set({ status: "Closed" })
    .where(and(eq(request_bids.status, "Pending"), sql`${request_bids.id} = ANY(${staleIds})`));

  return stale;
}
```

Also add imports at top: `ne, lt` from `"drizzle-orm"` and `sql` from `"drizzle-orm"`.

> **Note:** `requests` table currently has no `updated_at` column. Add it to the `requests` table in Task 1 Step 2 alongside the `offers` rename:
> ```typescript
> // In requests table definition, add:
> updated_at: timestamp("updated_at").notNull().defaultNow(),
> ```
> The migration will backfill `updated_at = created_at` for existing rows via `defaultNow()` semantics — existing rows get the migration timestamp, which is acceptable since all existing bids are test data.

- [ ] **Step 2: Update `lib/services/requests.service.ts`**

Remove `acceptRequestBid` and `rejectRequestBid`. Add `completeRequest` and `expireStaleRequestBids`:

```typescript
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
    sendPushToAllUsers(data.user_id, {
      title: "New request posted",
      body: data.title,
      url: `/`,
    }).catch(() => {});
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
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

export async function completeRequest(requestId: string, winningBidId: string) {
  await requestsRepo.updateRequestBidStatus(winningBidId, "Completed");
  await requestsRepo.bulkCloseRequestBids(requestId, winningBidId);
  const reqs = await requestsRepo.findRequests({ id: requestId });
  const req = reqs[0];
  if (req?.user_id) {
    await requestsRepo.updateRequest(
      requestId,
      { status: "Completed", completed_at: new Date() },
      req.user_id,
    );
  }
  // Return loser bids for notification dispatch by caller
  const allBids = await requestsRepo.findRequestBids({ request_id: requestId });
  const loserBids = allBids.filter((b) => b.id !== winningBidId && b.status === "Closed");
  const winnerBid = allBids.find((b) => b.id === winningBidId);
  return { winnerBid, loserBids, request: req };
}

export async function expireStaleRequestBids() {
  return await requestsRepo.expireStaleRequestBids();
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/repo/requests.repo.ts lib/services/requests.service.ts
git commit -m "feat: rework requests service — remove acceptRequestBid/rejectRequestBid, add completeRequest + expireStaleRequestBids"
```

---

### Task 4: Create `lib/actions/offers.ts` and rework `lib/actions/deals.ts`

**Files:**
- Create: `lib/actions/offers.ts`
- Modify: `lib/actions/deals.ts`
- Delete: `lib/actions/posts.ts`

- [ ] **Step 1: Create `lib/actions/offers.ts`**

```typescript
"use server";

import * as offersService from "@/lib/services/offers.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
  UpdateOfferSchema,
} from "@/lib/validation/offers";

export async function getOffers(filters: FindOffersSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.getOffers(filters);
  });
}

export async function getOfferBids(filters: FindOfferBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return offersService.getOfferBids(filters);
  });
}

export async function createOffer(data: InsertOfferSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.createOffer({ ...data, user_id: user.id });
  });
}

export async function createOfferBid(data: InsertOfferBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.createOfferBid({ ...data, bidder_id: user.id });
  });
}

export async function removeOffer(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.removeOffer(id, user.id);
  });
}

export async function removeOfferBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.removeOfferBid(id, user.id);
  });
}

export async function editOffer(id: string, data: UpdateOfferSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.editOffer(id, data, user.id);
  });
}
```

- [ ] **Step 2: Rewrite `lib/actions/deals.ts`**

```typescript
"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import * as offersService from "@/lib/services/offers.service";
import * as requestsService from "@/lib/services/requests.service";
import { sendPushToUser } from "@/lib/services/push.service";

type DealKind = "offer" | "request";

export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<{ parentStatus: string; ownerUserId: string | null }>(async () => {
    await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");
      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");
      return { parentStatus: req.status, ownerUserId: req.user_id };
    }

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");
    const offersList = await offersService.getOffers({ id: bid.post_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");
    return { parentStatus: offer.status, ownerUserId: offer.user_id };
  });
}

export async function completeRequest(requestId: string, winningBidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const { winnerBid, loserBids, request } =
      await requestsService.completeRequest(requestId, winningBidId);

    if (!request) return { success: true };

    // Notify winner
    if (winnerBid) {
      await sendPushToUser(winnerBid.bidder_id, "request_completed_winner", {
        title: "Your offer was accepted!",
        body: `${request.title} has been marked as done.`,
        url: `/reviews/new?targetId=${request.user_id}&context=${requestId}`,
        contextId: null,
      }).catch(() => {});
    }

    // Notify losers
    for (const loser of loserBids) {
      await sendPushToUser(loser.bidder_id, "request_completed_loser", {
        title: "Request fulfilled",
        body: `${request.title} has been fulfilled by someone else.`,
        url: `/`,
        contextId: null,
      }).catch(() => {});
    }

    return { success: true };
  });
}

export async function completeOfferBid(bidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");

    const offersList = await offersService.getOffers({ id: bid.post_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");

    await offersService.completeOfferBid(bidId);

    await sendPushToUser(bid.bidder_id, "offer_bid_completed", {
      title: "Deal confirmed!",
      body: `${offer.user_id} marked your deal on ${offer.title} as done.`,
      url: `/reviews/new?targetId=${offer.user_id}&context=${offer.id}`,
      contextId: null,
    }).catch(() => {});

    return { success: true };
  });
}

export async function closeOffer(offerId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    await offersService.closeOffer(offerId, user.id);
    return { success: true };
  });
}
```

- [ ] **Step 3: Delete `lib/actions/posts.ts`**

```bash
rm lib/actions/posts.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/offers.ts lib/actions/deals.ts lib/actions/posts.ts
git commit -m "feat: create offers actions; rework deals — remove acceptDeal, add completeRequest/completeOfferBid/closeOffer"
```

---

### Task 5: Update notification types and push service

**Files:**
- Modify: `lib/validation/notifications.ts`
- Modify: `lib/services/push.service.ts`

- [ ] **Step 1: Add new notification types to `lib/validation/notifications.ts`**

```typescript
export const NOTIFICATION_TYPES = [
  "new_inquiry",
  "new_message",
  "new_review",
  "new_request",
  "request_completed_winner",
  "request_completed_loser",
  "offer_bid_completed",
  "bid_expired",
] as const;

export const NotificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

// updatePreferencesSchema stays unchanged — new types don't have user-configurable prefs yet
```

- [ ] **Step 2: Update `EMAIL_EVENTS` set in `lib/services/push.service.ts`**

```typescript
// Replace:
const EMAIL_EVENTS = new Set<NotificationType>(["new_inquiry", "new_review"]);

// With:
const EMAIL_EVENTS = new Set<NotificationType>([
  "new_inquiry",
  "request_completed_winner",
  "offer_bid_completed",
]);
```

- [ ] **Step 3: Commit**

```bash
git add lib/validation/notifications.ts lib/services/push.service.ts
git commit -m "feat: add completion notification types; update email events strategy"
```

---

### Task 6: Update all import ripple — callers of `posts.*`

**Files:**
- Modify: `lib/services/messages.service.ts`
- Modify: `app/(protected)/(home)/page.tsx`
- Modify: `app/(protected)/(home)/create-offer/page.tsx`
- Modify: `app/(protected)/profile/page.tsx`
- Rename: `__tests__/lib/actions/posts.test.ts` → `__tests__/lib/actions/offers.test.ts`

- [ ] **Step 1: Update `lib/services/messages.service.ts` and related message repo/component**

The `messages` table column renamed from `post_bid_id` to `offer_bid_id` in Task 1. Update all Drizzle query references:

```bash
grep -rn "post_bid_id\|post_bids\|posts\b" lib/services/messages.service.ts lib/repo/ components/chat-room.tsx
```

For each file found:
- Replace `messages.post_bid_id` → `messages.offer_bid_id` in Drizzle `.where()` clauses
- Replace imports of `post_bids` → `offer_bids` from schema
- The `ChatRoom` component prop `post_bid_id` can keep its name — only the internal Drizzle column reference needs updating

Example change in a repo file:
```typescript
// Before:
.where(eq(messages.post_bid_id, postBidId))
// After:
.where(eq(messages.offer_bid_id, postBidId))
```

- [ ] **Step 2: Update `app/(protected)/(home)/page.tsx`**

```bash
grep -n "posts\|post_bid\|getPosts\|getPostBids\|createPost\|createPostBid" "app/(protected)/(home)/page.tsx"
```

Replace all `getPosts` → `getOffers`, `getPostBids` → `getOfferBids`, `createPost` → `createOffer`, `createPostBid` → `createOfferBid`. Update import paths from `@/lib/actions/posts` → `@/lib/actions/offers`.

- [ ] **Step 3: Update `app/(protected)/(home)/create-offer/page.tsx`**

```bash
grep -n "posts\|getPosts\|editPost\|createPost" "app/(protected)/(home)/create-offer/page.tsx"
```

Replace all occurrences. Update import path.

- [ ] **Step 4: Update `app/(protected)/profile/page.tsx`**

```bash
grep -n "posts\|getPosts\|getPostBids" "app/(protected)/profile/page.tsx"
```

Replace all occurrences. Update import path.

- [ ] **Step 5: Rename and update test file**

```bash
mv __tests__/lib/actions/posts.test.ts __tests__/lib/actions/offers.test.ts
```

Then update the imports inside:
```typescript
// Change:
import { createPost, createPostBid, removePost, removePostBid, editPost, getPosts } from "@/lib/actions/posts";
import * as postsService from "@/lib/services/posts.service";
// To:
import { createOffer, createOfferBid, removeOffer, removeOfferBid, editOffer, getOffers } from "@/lib/actions/offers";
import * as offersService from "@/lib/services/offers.service";
```

Update all `postsService.*` → `offersService.*`, `createPost` → `createOffer`, etc. throughout the test file.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all tests pass. Fix any broken imports or mock paths.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: update all imports from posts.* to offers.*"
```

---

### Task 7: Auto-expire cron endpoint

**Files:**
- Create: `app/api/cron/expire-bids/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `app/api/cron/expire-bids/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { expireStaleOfferBids } from "@/lib/services/offers.service";
import { expireStaleRequestBids } from "@/lib/services/requests.service";
import { sendPushToUser } from "@/lib/services/push.service";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [expiredOfferBids, expiredRequestBids] = await Promise.allSettled([
    expireStaleOfferBids(),
    expireStaleRequestBids(),
  ]);

  const offerResults = expiredOfferBids.status === "fulfilled" ? expiredOfferBids.value : [];
  const requestResults = expiredRequestBids.status === "fulfilled" ? expiredRequestBids.value : [];

  // Fire bid_expired notifications (fire-and-forget)
  await Promise.allSettled([
    ...offerResults.map((r) =>
      sendPushToUser(r.bidderId, "bid_expired", {
        title: "Inquiry closed",
        body: `${r.offerTitle} has been inactive for 2 weeks. Your inquiry was automatically closed.`,
        url: "/",
        contextId: null,
      }),
    ),
    ...requestResults.map((r) =>
      sendPushToUser(r.bidderId, "bid_expired", {
        title: "Inquiry closed",
        body: `${r.requestTitle} has been inactive for 2 weeks. Your inquiry was automatically closed.`,
        url: "/",
        contextId: null,
      }),
    ),
  ]);

  return NextResponse.json({
    expiredOfferBids: offerResults.length,
    expiredRequestBids: requestResults.length,
  });
}
```

- [ ] **Step 2: Add cron to `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-digest",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/expire-bids",
      "schedule": "5 0 * * *"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/expire-bids/route.ts vercel.json
git commit -m "feat: add expire-bids cron — auto-closes stale pending bids after 14 days"
```

---

### Task 8: Tracker page — Close/Withdraw buttons + History section

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

- [ ] **Step 1: Add `deleteLabel` prop to `ItemRequestCard` (`components/ui/item.tsx`)**

`ItemRequestCard` currently has `onDelete` prop with a hardcoded "Delete" button label. Add an optional `deleteLabel` prop so the tracker can display "Close" or "Withdraw" instead:

```typescript
// In ItemRequestCard props interface, add:
deleteLabel?: string; // defaults to "Delete" if omitted
```

In the button JSX:
```tsx
// Before:
<button ...>Delete</button>
// After:
<button ...>{deleteLabel ?? "Delete"}</button>
```

- [ ] **Step 3: Update imports in tracker**

Replace all `getPosts`, `getPostBids`, `removePost` → `getOffers`, `getOfferBids`, `removeOffer`. Import `closeOffer` from `@/lib/actions/deals`. Import `removeOfferBid` from `@/lib/actions/offers`. Import `ChevronDown`, `ChevronRight` from `react-bootstrap-icons`.

- [ ] **Step 2: Update `fetchTrackerData` — use offers API**

Replace every `getPosts` call with `getOffers`, `getPostBids` with `getOfferBids`. Column `post_id` stays the same on `offer_bids` (it's the FK column name in the table). The `TrackerOffer` type `id` field for bid-cards uses `bid-${bid.id}` — keep that convention.

Also add `status` to the `TrackerOffer` type:

```typescript
type TrackerOffer = {
  id: string;
  itemName: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  type: string | null;
  status: string; // offer status: Active | Closed
  isOwned: boolean;
  requesterCount: number;
  requesters: { id: string; name: string; bidId: string; bidStatus: string }[];
};
```

Add `bidStatus` to each requester entry (used to filter History):

```typescript
requesters: bids.map((bid) => ({
  id: bid.bidder_id,
  name: usersMap.get(bid.bidder_id) ?? "User",
  bidId: bid.id,
  bidStatus: bid.status,
})),
```

- [ ] **Step 4: Separate active vs history cards**

After building `offerList` and `requestList`, split them:

```typescript
// Active = offers that are Active, requests that are Active/Ongoing
const activeOffers = offerList.filter((o) =>
  o.isOwned ? o.status === "Active" : o.requesters.some((r) => r.bidStatus === "Pending"),
);
const historyOffers = offerList.filter((o) =>
  o.isOwned ? o.status === "Closed" : o.requesters.every((r) => r.bidStatus !== "Pending"),
);
const activeRequests = requestList.filter((r) =>
  r.isOwned ? r.status !== "Completed" && r.status !== "Cancelled" : r.status !== "Completed" && r.status !== "Cancelled",
);
const historyRequests = requestList.filter((r) =>
  r.status === "Completed" || r.status === "Cancelled",
);
```

Add state:
```typescript
const [historyOpen, setHistoryOpen] = useState(false);
```

- [ ] **Step 5: Replace `handleDeleteOffer` with `handleCloseOffer` and add `handleWithdrawOfferBid` / `handleWithdrawRequestBid`**

```typescript
const handleCloseOffer = async (offerId: string) => {
  if (!window.confirm("Close this offer? All open inquiries will be ended.")) return;
  const { error } = await closeOffer(offerId);
  if (error) { alert("Failed to close offer. Please try again."); return; }
  setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, status: "Closed" } : o));
};

const handleWithdrawOfferBid = async (bidId: string) => {
  if (!window.confirm("Withdraw your inquiry?")) return;
  const { error } = await removeOfferBid(bidId);
  if (error) { alert("Failed to withdraw. Please try again."); return; }
  setOffers((prev) => prev.filter((o) => o.id !== `bid-${bidId}`));
};

const handleWithdrawRequestBid = async (bidId: string) => {
  if (!window.confirm("Withdraw your bid?")) return;
  const { error } = await removeRequestBid(bidId);
  if (error) { alert("Failed to withdraw. Please try again."); return; }
  setRequests((prev) => prev.filter((r) => r.id !== `bid-${bidId}`));
};
```

Keep `handleDeleteRequest` for owned active requests (still deletes).

- [ ] **Step 6: Update card rendering**

For owned offer cards: pass `onEdit` + replace `onDelete` with `onClose` prop name. Since `ItemRequestCard` uses `onDelete`, pass `closeOffer` handler as `onDelete` for now (the button text is controlled by the prop label — check if `ItemRequestCard` exposes a delete label prop; if not, the button will say "Delete" until Task 9 updates it).

For non-owned offer cards (bid-cards): pass `onDelete` → `handleWithdrawOfferBid`, with the bid id extracted from `card.data.id` (`bid-${bidId}` → strip prefix or store `bidId` separately). Store the raw `bidId` in a new field on `TrackerOffer`:

```typescript
type TrackerOffer = {
  // ... existing fields
  rawBidId?: string; // set only for non-owned bid-cards
};
```

For non-owned request cards: same — `onDelete` → `handleWithdrawRequestBid`.

- [ ] **Step 7: Add History section below the active cards grid**

```tsx
{/* History toggle */}
{(historyCards.length > 0) && (
  <div className="max-w-7xl mx-auto w-full mt-6">
    <button
      type="button"
      onClick={() => setHistoryOpen((o) => !o)}
      className="flex items-center gap-2 w-full text-sm font-semibold text-gray-500 py-2 border-t border-gray-200"
    >
      {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      History ({historyCards.length})
    </button>
    {historyOpen && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 opacity-50 pointer-events-none">
        {historyCards.map((card) => (
          // Same ItemRequestCard rendering as active, but no onEdit/onDelete/onClose
          // ... same pattern as active cards, omit action props
        ))}
      </div>
    )}
  </div>
)}
```

Where `historyCards` combines filtered `historyOffers` + `historyRequests` (applying active filter tab same as active cards).

- [ ] **Step 8: Run lint and verify no TypeScript errors**

```bash
npm run lint
```

Fix any errors.

- [ ] **Step 9: Commit**

```bash
git add components/ui/item.tsx app/(protected)/tracker/page.tsx
git commit -m "feat: tracker — Close/Withdraw replaces Delete, add History section; ItemRequestCard deleteLabel prop"
```

---

### Task 9: ChatListModal — "Mark done" per row

**Files:**
- Modify: `app/(protected)/tracker/page.tsx` (the inline `ChatListModal` component)

- [ ] **Step 1: Extend `ChatListModal` props**

```typescript
function ChatListModal({
  title,
  people,
  accentClass,
  avatarClass,
  iconClass,
  onSelect,
  onClose,
  onMarkDone,        // new — called with (bidId)
  itemId,            // new — requestId or offerId for completeRequest
  kind,              // "offer" | "request"
}: {
  title: string;
  people: { id: string; name: string; bidId: string }[];
  accentClass: string;
  avatarClass: string;
  iconClass: string;
  onSelect: (bidId: string, id: string) => void;
  onClose: () => void;
  onMarkDone?: (bidId: string) => Promise<void>;
  itemId?: string;
  kind?: "offer" | "request";
})
```

- [ ] **Step 2: Add "Mark done" button to each person row**

Inside the `<li>` for each person, after the `ChatDotsFill` icon:

```tsx
{onMarkDone && (
  <button
    type="button"
    onClick={async (e) => {
      e.stopPropagation();
      await onMarkDone(p.bidId);
    }}
    className="shrink-0 text-xs font-medium border border-gray-300 rounded px-2 py-1 text-gray-600 hover:border-gray-500 transition-colors ml-1"
  >
    Mark done
  </button>
)}
```

- [ ] **Step 3: Wire `onMarkDone` in the tracker page**

For request modal:
```typescript
onMarkDone={async (bidId) => {
  if (!window.confirm("Mark this deal as done?")) return;
  const { error } = await completeRequest(modalData.id, bidId);
  if (error) { alert("Failed. Please try again."); return; }
  setModalData(null);
  // Refresh tracker state
  setRequests((prev) => prev.map((r) =>
    r.id === modalData.id ? { ...r, status: "Completed" } : r,
  ));
}}
```

For offer modal:
```typescript
onMarkDone={async (bidId) => {
  if (!window.confirm("Mark this deal as done?")) return;
  const { error } = await completeOfferBid(bidId);
  if (error) { alert("Failed. Please try again."); return; }
  // Remove completed person from modal list
  setModalData((prev) => prev ? {
    ...prev,
    people: prev.people.filter((p) => p.bidId !== bidId),
  } : null);
}}
```

Import `completeRequest`, `completeOfferBid` from `@/lib/actions/deals`.

- [ ] **Step 4: Pass `itemId` and `kind` to modal**

```tsx
<ChatListModal
  ...
  itemId={modalData.id}
  kind={modalData.type}
  onMarkDone={...}
/>
```

Update `modalData` state type to include `id` (the post/request id, not bid id):

```typescript
const [modalData, setModalData] = useState<{
  id: string;         // offer id or request id
  title: string;
  people: { id: string; name: string; bidId: string }[];
  type: "offer" | "request";
} | null>(null);
```

Update each `setModalData` call to include `id`.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/tracker/page.tsx
git commit -m "feat: ChatListModal — add Mark done per bid row for offers and requests"
```

---

### Task 10: Chat page rewrite — remove sidebar, add route guard + Mark done + banners

**Files:**
- Modify: `app/(protected)/chat/page.tsx`
- Delete (or reduce): `components/ui/skeletons/chat-skeleton.tsx`

- [ ] **Step 1: Check what else uses `ChatSidebarSkeleton`**

```bash
grep -rn "ChatSidebarSkeleton" .
```

If only used in `chat/page.tsx`, delete that export from the skeleton file (or delete the whole file if it's the only export).

- [ ] **Step 2: Rewrite `app/(protected)/chat/page.tsx`**

```typescript
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, StarFill } from "react-bootstrap-icons";
import Navbar from "@/components/ui/navbar";
import { ChatRoom } from "@/components/chat-room";
import { useAuth } from "@/contexts/auth-context";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { getDealStatus, completeRequest, completeOfferBid } from "@/lib/actions/deals";
import { getUserAvatarUrl } from "@/lib/actions/users";
import { getReviews } from "@/lib/actions/reviews";

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const bidId = params.get("bidId") ?? "";
  const kind = (params.get("kind") ?? "offer") as "offer" | "request";
  const title = params.get("title") ?? "";
  const otherId = params.get("otherId") ?? "";

  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [otherName, setOtherName] = useState("");
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [otherRating, setOtherRating] = useState<number | null>(null);
  const [parentStatus, setParentStatus] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  // Route guard
  useEffect(() => {
    if (!bidId || !otherId) {
      router.replace("/tracker");
    }
  }, [bidId, otherId, router]);

  useEffect(() => {
    if (!bidId || !otherId) return;

    // Load deal status + other user info in parallel
    Promise.all([
      getDealStatus(bidId, kind),
      getUserAvatarUrl(otherId),
      getReviews({ rated_user_id: otherId }),
    ]).then(([statusResult, avatarUrl, reviewsResult]) => {
      if (statusResult.data) {
        setParentStatus(statusResult.data.parentStatus);
        setOwnerUserId(statusResult.data.ownerUserId);
        const s = statusResult.data.parentStatus;
        if (s === "Completed" || s === "Closed") setIsDone(true);
      }
      setOtherAvatarUrl(avatarUrl);
      const reviews = reviewsResult.data ?? [];
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setOtherRating(Math.round(avg * 10) / 10);
      }
    });
  }, [bidId, otherId, kind]);

  const isOwner = ownerUserId === currentUser.id;

  const bannerText = isDone
    ? kind === "request"
      ? "This request has been fulfilled."
      : "This offer is closed."
    : null;

  const handleMarkDone = async () => {
    if (!window.confirm("Mark this deal as done?")) return;
    let error: string | null = null;
    if (kind === "offer") {
      const result = await completeOfferBid(bidId);
      error = result.error ?? null;
    } else {
      const result = await completeRequest(/* requestId */ "", bidId);
      // Need requestId — fetch from getDealStatus which returns ownerUserId but not requestId
      // Solution: store requestId from deal status. See note below.
      error = result.error ?? null;
    }
    if (error) { alert("Failed. Please try again."); return; }
    setIsDone(true);
  };

  if (!bidId || !otherId) return null;

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <Navbar />

      {/* Header */}
      <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full border border-[#3761B0] text-[#3761B0] flex items-center justify-center shrink-0"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden shrink-0">
          {otherAvatarUrl ? (
            <Image src={otherAvatarUrl} alt={otherName || "User"} width={36} height={36} className="object-cover w-full h-full" />
          ) : (
            <span className="flex items-center justify-center w-full h-full text-sm font-medium text-gray-500 uppercase">
              {(otherName || "U").charAt(0)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 leading-tight line-clamp-1 text-sm">
              {title}{otherName ? ` | ${otherName}` : ""}
            </p>
            {otherRating != null ? (
              <span className="flex items-center gap-0.5 text-xs font-medium text-gray-600 shrink-0">
                {otherRating}<StarFill className="text-[#DEA440]" size={12} />
              </span>
            ) : (
              <span className="text-xs text-gray-400 italic shrink-0">No reviews yet</span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-tight">
            {kind === "offer" ? "Offer" : "Request"}
          </p>
        </div>

        {isOwner && !isDone && (
          <button
            type="button"
            onClick={handleMarkDone}
            className="shrink-0 text-xs font-medium border border-gray-400 rounded px-3 py-1.5 text-gray-600 hover:border-gray-600 transition-colors"
          >
            Mark done
          </button>
        )}
      </header>

      {/* Completion banner */}
      {bannerText && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm text-green-700 font-medium text-center shrink-0">
          {bannerText}
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatRoom
          other_user_id={otherId}
          post_bid_id={kind === "offer" ? bidId : null}
          request_bid_id={kind === "request" ? bidId : null}
          disabled={isDone}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PageShellSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}
```

> **Note on `completeRequest` in chat:** `completeRequest(requestId, bidId)` needs the `requestId`, not just `bidId`. Update `getDealStatus` to also return `parentId` (the request or offer id) so the chat page can call `completeRequest(parentId, bidId)`. Add `parentId: string` to `getDealStatus` return type and fetch it in `deals.ts`.

- [ ] **Step 3: Update `getDealStatus` to return `parentId`**

In `lib/actions/deals.ts`, update the return type and value:

```typescript
export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<{ parentStatus: string; ownerUserId: string | null; parentId: string }>(
    async () => {
      await requireAuth();

      if (kind === "request") {
        const bids = await requestsService.getRequestBids({ id: bidId });
        const bid = bids[0];
        if (!bid) throw new Error("Request bid not found");
        const reqs = await requestsService.getRequests({ id: bid.request_id });
        const req = reqs[0];
        if (!req) throw new Error("Request not found");
        return { parentStatus: req.status, ownerUserId: req.user_id, parentId: req.id };
      }

      const bids = await offersService.getOfferBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Offer bid not found");
      const offersList = await offersService.getOffers({ id: bid.post_id });
      const offer = offersList[0];
      if (!offer) throw new Error("Offer not found");
      return { parentStatus: offer.status, ownerUserId: offer.user_id, parentId: offer.id };
    },
  );
}
```

Then in `ChatPageInner`, store `parentId`:

```typescript
const [parentId, setParentId] = useState("");
// In the effect:
setParentId(statusResult.data.parentId);
// In handleMarkDone for request:
const result = await completeRequest(parentId, bidId);
```

- [ ] **Step 4: Check if `ChatRoom` supports a `disabled` prop**

```bash
grep -n "disabled\|readOnly\|isDisabled" components/chat-room.tsx
```

If `ChatRoom` doesn't accept `disabled`, add the prop and use it to disable the input. This is a minimal change to `chat-room.tsx` — just thread `disabled?: boolean` through to the message input's `disabled` attribute.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Fix any errors.

- [ ] **Step 6: Commit**

```bash
git add app/(protected)/chat/page.tsx lib/actions/deals.ts components/chat-room.tsx
git add components/ui/skeletons/chat-skeleton.tsx
git commit -m "feat: chat page rewrite — remove sidebar, single-panel, route guard, Mark done, completion banners"
```

---

### Task 11: Write tests for new deals actions

**Files:**
- Create: `__tests__/lib/actions/deals.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { completeRequest, completeOfferBid, closeOffer, getDealStatus } from "@/lib/actions/deals";
import * as requestsService from "@/lib/services/requests.service";
import * as offersService from "@/lib/services/offers.service";
import * as pushService from "@/lib/services/push.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/requests.service");
jest.mock("@/lib/services/offers.service");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-owner" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("deals actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
    (pushService.sendPushToUser as jest.Mock).mockResolvedValue(undefined);
  });

  describe("getDealStatus", () => {
    it("returns parentStatus and ownerUserId for a request bid", async () => {
      (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", request_id: "req-1", bidder_id: "bidder-1", status: "Pending" },
      ]);
      (requestsService.getRequests as jest.Mock).mockResolvedValue([
        { id: "req-1", user_id: "user-owner", status: "Active" },
      ]);

      const result = await getDealStatus("bid-1", "request");

      expect(result.data?.parentStatus).toBe("Active");
      expect(result.data?.ownerUserId).toBe("user-owner");
      expect(result.data?.parentId).toBe("req-1");
    });

    it("returns error when bid not found", async () => {
      (requestsService.getRequestBids as jest.Mock).mockResolvedValue([]);

      const result = await getDealStatus("bad-bid", "request");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("completeRequest", () => {
    it("completes winning bid and closes losers", async () => {
      const mockCompleteRequest = requestsService.completeRequest as jest.Mock;
      mockCompleteRequest.mockResolvedValue({
        winnerBid: { id: "bid-1", bidder_id: "bidder-win" },
        loserBids: [{ id: "bid-2", bidder_id: "bidder-lose" }],
        request: { id: "req-1", title: "Need a pen", user_id: "user-owner", status: "Completed" },
      });

      const result = await completeRequest("req-1", "bid-1");

      expect(result.data).toEqual({ success: true });
      expect(mockCompleteRequest).toHaveBeenCalledWith("req-1", "bid-1");
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-win",
        "request_completed_winner",
        expect.objectContaining({ title: "Your offer was accepted!" }),
      );
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-lose",
        "request_completed_loser",
        expect.objectContaining({ title: "Request fulfilled" }),
      );
    });
  });

  describe("completeOfferBid", () => {
    it("completes the bid and notifies the bidder", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", post_id: "offer-1" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "user-owner", title: "Calculus notes", status: "Active" },
      ]);
      (offersService.completeOfferBid as jest.Mock).mockResolvedValue(undefined);

      const result = await completeOfferBid("bid-1");

      expect(result.data).toEqual({ success: true });
      expect(offersService.completeOfferBid).toHaveBeenCalledWith("bid-1");
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-1",
        "offer_bid_completed",
        expect.objectContaining({ title: "Deal confirmed!" }),
      );
    });
  });

  describe("closeOffer", () => {
    it("closes the offer as the authenticated user", async () => {
      (offersService.closeOffer as jest.Mock).mockResolvedValue(undefined);

      const result = await closeOffer("offer-1");

      expect(result.data).toEqual({ success: true });
      expect(offersService.closeOffer).toHaveBeenCalledWith("offer-1", "user-owner");
    });

    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await closeOffer("offer-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });
});
```

- [ ] **Step 2: Run the failing tests first**

```bash
npm test -- __tests__/lib/actions/deals.test.ts
```

Expected: tests fail (actions not fully wired yet if running tasks out of order, or pass if previous tasks are done).

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/lib/actions/deals.test.ts
git commit -m "test: add deals actions tests for completeRequest, completeOfferBid, closeOffer, getDealStatus"
```

---

### Task 12: Notification deep-link URLs for existing `new_inquiry` / `new_message`

**Files:**
- Modify: `lib/services/messages.service.ts`

- [ ] **Step 1: Find where `new_inquiry` and `new_message` notifications are sent**

```bash
grep -n "new_inquiry\|new_message\|sendPushToUser" lib/services/messages.service.ts
```

- [ ] **Step 2: Update the `url` field to the chat deep-link format**

For each `sendPushToUser` call with type `new_inquiry` or `new_message`, set:

```typescript
url: `/chat?bidId=${bidId}&kind=${kind}&title=${encodeURIComponent(title)}&otherId=${senderId}`,
```

Where `bidId`, `kind`, `title`, `senderId` are the values available in that context. The exact parameter names depend on the function signature — read the surrounding code and thread the values through.

- [ ] **Step 3: Commit**

```bash
git add lib/services/messages.service.ts
git commit -m "feat: set chat deep-link url on new_inquiry and new_message push notifications"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass, no failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Verify DB push already applied**

Schema was pushed in Task 1 via `npx drizzle-kit push`. Confirm the Supabase dashboard reflects the renamed tables (`offers`, `offer_bids`) and new columns (`updated_at`, `offer_bids.status`).

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: post-finishing-system final cleanup"
```
