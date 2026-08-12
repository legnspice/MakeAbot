# Epic F — Tracker & Chat Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tracker's ~21-action N+1 fan-out with a single server-side `getTrackerData` aggregation, and remove the chat's serial/duplicate fetches — without touching auth or changing behavior.

**Architecture:** Add optional `inArray` batch fields to the offers/requests find-schemas + repos (empty-array-safe). A new `tracker.service.getTrackerData(userId)` composes those batched queries + one `findUsers`, groups in memory via pure helpers, and returns the **same four groupings the tracker client already builds** plus a `userNames` map — so the client's card-mapping code stays byte-identical. Chat passes name/avatar/deal-done from the page into `ChatRoom` as props, so the room stops re-fetching them.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Zod, Jest.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). No new branch. **No schema/migration changes** — this epic adds no columns (it only adds `SelectRequest`/`SelectRequestBid` type exports).
- Layered backend: Server Action → Service → Repository → DB. `getTrackerData` derives the user id from `requireAuth()` (not a client arg); one `requireAuth()` for the whole tracker.
- **Empty-array safety (critical):** a batch field present but empty must return `[]` — never an unfiltered table scan. Unit-tested.
- **Behavior parity (highest risk):** the tracker must render byte-identical cards (same owned/bid-on grouping, counterparty names, statuses, badge counts). The refactor preserves the existing client mapping verbatim, only swapping its data source.
- **Chat fallback:** `ChatRoom` must still work if a new prop is absent (fallback fetch), so nothing breaks mid-refactor.
- Do NOT touch the home feed (already batched) or the `requireAuth` amplifier (deferred).
- Only touched files must be lint-clean; `npm format` before push.

---

### Task 1: Batch fields on find-schemas + `hasEmptyBatch` helper (TDD)

**Files:**
- Create: `lib/batch.ts`
- Test: `__tests__/lib/batch.test.ts`
- Modify: `lib/validation/offers.ts`
- Modify: `lib/validation/requests.ts`

**Interfaces:**
- Produces: `hasEmptyBatch(...arrays: (readonly unknown[] | undefined | null)[]): boolean` (true if any provided arg is a present array of length 0); `FindOffersSchema` gains `ids?: string[]`; `FindRequestsSchema` gains `ids?: string[]`; `FindOfferBidsSchema` gains `offer_ids?: string[]`; `FindRequestBidsSchema` gains `request_ids?: string[]`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/batch.test.ts`:

```ts
import { hasEmptyBatch } from "@/lib/batch";

describe("hasEmptyBatch", () => {
  it("true when any present array is empty", () => {
    expect(hasEmptyBatch([])).toBe(true);
    expect(hasEmptyBatch(["a"], [])).toBe(true);
  });
  it("false when arrays are non-empty or absent", () => {
    expect(hasEmptyBatch(["a"])).toBe(false);
    expect(hasEmptyBatch(undefined)).toBe(false);
    expect(hasEmptyBatch(null)).toBe(false);
    expect(hasEmptyBatch(undefined, ["a"])).toBe(false);
  });
  it("false with no args", () => {
    expect(hasEmptyBatch()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/batch.test.ts`
Expected: FAIL — cannot find module `@/lib/batch`.

- [ ] **Step 3: Implement the helper**

Create `lib/batch.ts`:

```ts
/** True if any provided argument is a present array with length 0.
 *  Repos use this to short-circuit an empty batch to [] instead of scanning. */
export function hasEmptyBatch(
  ...arrays: (readonly unknown[] | undefined | null)[]
): boolean {
  return arrays.some((a) => Array.isArray(a) && a.length === 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/batch.test.ts`
Expected: PASS.

- [ ] **Step 5: Add batch fields to the offer schemas**

In `lib/validation/offers.ts`, extend the two find-schemas (they are `.pick(...).partial()` today — append `.extend(...)`):

```ts
export const findOffersSchema = offerSchema
  .pick({
    id: true,
    user_id: true,
    price: true,
    title: true,
    status: true,
    created_at: true,
  })
  .partial()
  .extend({ ids: z.array(z.string().uuid()).optional() });

export const findOfferBidsSchema = offerBidSchema
  .pick({ id: true, offer_id: true, bidder_id: true, created_at: true })
  .partial()
  .extend({ offer_ids: z.array(z.string().uuid()).optional() });
```

- [ ] **Step 6: Add batch fields to the request schemas**

In `lib/validation/requests.ts`, apply the same pattern: add `.extend({ ids: z.array(z.string().uuid()).optional() })` to `findRequestsSchema` and `.extend({ request_ids: z.array(z.string().uuid()).optional() })` to `findRequestBidsSchema`. (Match the exact `.pick(...).partial()` shapes already present in that file; only append the `.extend`.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the new fields are optional; existing callers unaffected).

- [ ] **Step 8: Commit**

```bash
git add lib/batch.ts __tests__/lib/batch.test.ts lib/validation/offers.ts lib/validation/requests.ts
git commit -m "feat(batch): hasEmptyBatch helper + ids/offer_ids/request_ids on find-schemas"
```

---

### Task 2: `inArray` support in the offers/requests repos

**Files:**
- Modify: `lib/repo/offers.repo.ts`
- Modify: `lib/repo/requests.repo.ts`

**Interfaces:**
- Consumes: `hasEmptyBatch` (Task 1) + the new schema fields; `inArray` (already imported in both repos).
- Produces: `findOffers`/`findRequests` filter by `inArray(id, ids)` when `ids` present; `findOfferBids`/`findRequestBids` filter by `inArray(offer_id, offer_ids)` / `inArray(request_id, request_ids)`; all four return `[]` immediately on an empty batch field.

- [ ] **Step 1: `findOffers` — batch by ids**

In `lib/repo/offers.repo.ts`, add the import `import { hasEmptyBatch } from "../batch";`. In `findOffers`, destructure `ids` and add the guard + condition:

```ts
export async function findOffers(filters: FindOffersSchema) {
  const { id, user_id, price, title, status, created_at, ids } = filters;
  if (hasEmptyBatch(ids)) return [];
  const conditions = [];
  if (id) conditions.push(eq(offers.id, id));
  if (ids && ids.length > 0) conditions.push(inArray(offers.id, ids));
  if (user_id) conditions.push(eq(offers.user_id, user_id));
  // ...rest unchanged (price/status/title/created_at)...
```

- [ ] **Step 2: `findOfferBids` — batch by offer_ids**

In `findOfferBids`:

```ts
export async function findOfferBids(filters: FindOfferBidsSchema) {
  const { id, offer_id, bidder_id, created_at, offer_ids } = filters;
  if (hasEmptyBatch(offer_ids)) return [];
  const conditions = [];
  if (id) conditions.push(eq(offer_bids.id, id));
  if (offer_id) conditions.push(eq(offer_bids.offer_id, offer_id));
  if (offer_ids && offer_ids.length > 0)
    conditions.push(inArray(offer_bids.offer_id, offer_ids));
  if (bidder_id) conditions.push(eq(offer_bids.bidder_id, bidder_id));
  // ...rest unchanged...
```

- [ ] **Step 3: Mirror in the requests repo**

In `lib/repo/requests.repo.ts`, add `import { hasEmptyBatch } from "../batch";`. In `findRequests`: destructure `ids`, add `if (hasEmptyBatch(ids)) return [];` and `if (ids && ids.length > 0) conditions.push(inArray(requests.id, ids));`. In `findRequestBids`: destructure `request_ids`, add `if (hasEmptyBatch(request_ids)) return [];` and `if (request_ids && request_ids.length > 0) conditions.push(inArray(request_bids.request_id, request_ids));`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/offers.repo.ts lib/repo/requests.repo.ts
git commit -m "feat(repo): inArray batch filters for offers/requests/bids (empty-safe)"
```

---

### Task 3: Pure grouping helpers (TDD)

**Files:**
- Create: `lib/tracker.ts`
- Test: `__tests__/lib/tracker.test.ts`

**Interfaces:**
- Produces:
  - `indexById<T extends { id: string }>(rows: T[]): Map<string, T>`
  - `groupBidsByParent<B>(bids: B[], parentKey: (b: B) => string): Map<string, B[]>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/tracker.test.ts`:

```ts
import { indexById, groupBidsByParent } from "@/lib/tracker";

describe("indexById", () => {
  it("maps rows by id", () => {
    const m = indexById([{ id: "a", v: 1 }, { id: "b", v: 2 }]);
    expect(m.get("a")).toEqual({ id: "a", v: 1 });
    expect(m.get("z")).toBeUndefined();
  });
});

describe("groupBidsByParent", () => {
  it("groups bids under their parent key", () => {
    const bids = [
      { id: "1", offer_id: "o1" },
      { id: "2", offer_id: "o1" },
      { id: "3", offer_id: "o2" },
    ];
    const m = groupBidsByParent(bids, (b) => b.offer_id);
    expect(m.get("o1")).toHaveLength(2);
    expect(m.get("o2")).toHaveLength(1);
    expect(m.get("o3")).toBeUndefined();
  });
  it("returns an empty map for no bids", () => {
    expect(groupBidsByParent([], (b: { offer_id: string }) => b.offer_id).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/tracker.test.ts`
Expected: FAIL — cannot find module `@/lib/tracker`.

- [ ] **Step 3: Implement**

Create `lib/tracker.ts`:

```ts
export function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function groupBidsByParent<B>(
  bids: B[],
  parentKey: (b: B) => string,
): Map<string, B[]> {
  const m = new Map<string, B[]>();
  for (const b of bids) {
    const k = parentKey(b);
    const arr = m.get(k);
    if (arr) arr.push(b);
    else m.set(k, [b]);
  }
  return m;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/tracker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tracker.ts __tests__/lib/tracker.test.ts
git commit -m "feat(tracker): pure indexById + groupBidsByParent helpers (tested)"
```

---

### Task 4: `getTrackerData` service + action

**Files:**
- Modify: `lib/db/schema.ts` (export `SelectRequest`, `SelectRequestBid`)
- Create: `lib/services/tracker.service.ts`
- Create: `lib/actions/tracker.ts`

**Interfaces:**
- Consumes: batched `offersRepo.findOffers/findOfferBids`, `requestsRepo.findRequests/findRequestBids` (Task 2); `usersRepo.findUsers`; `indexById`/`groupBidsByParent` (Task 3).
- Produces: `getTrackerData(userId): Promise<TrackerData>` (service) and a `getTrackerData()` action (session-derived user id). `TrackerData`:
  ```ts
  export type TrackerData = {
    offerBidGroups: { offer: SelectOffer; bids: SelectOfferBid[] }[];
    reqBidGroups: { req: SelectRequest; bids: SelectRequestBid[] }[];
    bidOfferGroups: { bid: SelectOfferBid; offer: SelectOffer | null }[];
    bidReqGroups: { bid: SelectRequestBid; req: SelectRequest | null }[];
    userNames: Record<string, string>;
  };
  ```

- [ ] **Step 1: Export the missing Select types**

In `lib/db/schema.ts`, next to the other `Select*` exports, add (if not already present):

```ts
export type SelectRequest = typeof requests.$inferSelect;
export type SelectRequestBid = typeof request_bids.$inferSelect;
```

- [ ] **Step 2: Write the service**

Create `lib/services/tracker.service.ts`:

```ts
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import * as usersRepo from "../repo/users.repo";
import { indexById, groupBidsByParent } from "../tracker";
import type {
  SelectOffer,
  SelectOfferBid,
  SelectRequest,
  SelectRequestBid,
} from "../db/schema";

export type TrackerData = {
  offerBidGroups: { offer: SelectOffer; bids: SelectOfferBid[] }[];
  reqBidGroups: { req: SelectRequest; bids: SelectRequestBid[] }[];
  bidOfferGroups: { bid: SelectOfferBid; offer: SelectOffer | null }[];
  bidReqGroups: { bid: SelectRequestBid; req: SelectRequest | null }[];
  userNames: Record<string, string>;
};

export async function getTrackerData(userId: string): Promise<TrackerData> {
  // 1. Base queries (parallel).
  const [ownedOffers, ownedRequests, myOfferBids, myReqBids] =
    await Promise.all([
      offersRepo.findOffers({ user_id: userId }),
      requestsRepo.findRequests({ user_id: userId }),
      offersRepo.findOfferBids({ bidder_id: userId }),
      requestsRepo.findRequestBids({ bidder_id: userId }),
    ]);

  // 2. Batched hydration (parallel).
  const [bidsOnOwnedOffers, bidsOnOwnedRequests, bidOffers, bidRequests] =
    await Promise.all([
      offersRepo.findOfferBids({ offer_ids: ownedOffers.map((o) => o.id) }),
      requestsRepo.findRequestBids({
        request_ids: ownedRequests.map((r) => r.id),
      }),
      offersRepo.findOffers({ ids: myOfferBids.map((b) => b.offer_id) }),
      requestsRepo.findRequests({ ids: myReqBids.map((b) => b.request_id) }),
    ]);

  // 3. Group in memory (mirrors the old client fan-out shapes exactly).
  const bidsByOffer = groupBidsByParent(bidsOnOwnedOffers, (b) => b.offer_id);
  const bidsByRequest = groupBidsByParent(
    bidsOnOwnedRequests,
    (b) => b.request_id,
  );
  const offerById = indexById(bidOffers);
  const requestById = indexById(bidRequests);

  const offerBidGroups = ownedOffers.map((offer) => ({
    offer,
    bids: bidsByOffer.get(offer.id) ?? [],
  }));
  const reqBidGroups = ownedRequests.map((req) => ({
    req,
    bids: bidsByRequest.get(req.id) ?? [],
  }));
  const bidOfferGroups = myOfferBids.map((bid) => ({
    bid,
    offer: offerById.get(bid.offer_id) ?? null,
  }));
  const bidReqGroups = myReqBids.map((bid) => ({
    bid,
    req: requestById.get(bid.request_id) ?? null,
  }));

  // 4. One batched name lookup for every counterparty.
  const userIds = new Set<string>();
  for (const g of offerBidGroups) for (const b of g.bids) userIds.add(b.bidder_id);
  for (const g of reqBidGroups) for (const b of g.bids) userIds.add(b.bidder_id);
  for (const g of bidOfferGroups) if (g.offer?.user_id) userIds.add(g.offer.user_id);
  for (const g of bidReqGroups) if (g.req?.user_id) userIds.add(g.req.user_id);

  const userNames: Record<string, string> = {};
  if (userIds.size > 0) {
    const users = await usersRepo.findUsers({ ids: Array.from(userIds) });
    for (const u of users) userNames[u.id] = u.name ?? "User";
  }

  return { offerBidGroups, reqBidGroups, bidOfferGroups, bidReqGroups, userNames };
}
```

- [ ] **Step 3: Write the action**

Create `lib/actions/tracker.ts`:

```ts
"use server";

import * as trackerService from "@/lib/services/tracker.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";

export async function getTrackerData() {
  return await handleAction(async () => {
    const user = await requireAuth();
    return trackerService.getTrackerData(user.id);
  });
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/services/tracker.service.ts lib/actions/tracker.ts
git commit -m "feat(tracker): getTrackerData server-side aggregation (1 action, batched)"
```

---

### Task 5: Tracker page consumes `getTrackerData`

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

**Interfaces:**
- Consumes: `getTrackerData` (Task 4). The client card mapping (the `offerList`/`requestList` construction) is preserved **verbatim**, only its data source changes and `usersMap.get(x) ?? "User"` becomes `userNames[x] ?? "User"`.

- [ ] **Step 1: Swap imports**

In `app/(protected)/tracker/page.tsx`, add `import { getTrackerData } from "@/lib/actions/tracker";`. Remove now-unused imports from the `@/lib/actions/offers`, `@/lib/actions/requests`, and `@/lib/actions/users` import groups: delete `getOffers`, `getOfferBids`, `getRequests`, `getRequestBids`, and `getUsers` **only if** they are not referenced elsewhere in the file (the mutation handlers use `removeOfferBid`/`withdrawOfferBid`/`removeRequest`/`removeRequestBid` and the deal actions — keep those). Let lint/tsc confirm nothing dangling.

- [ ] **Step 2: Replace the fetch/fan-out body of `fetchTrackerData`**

Replace everything in `fetchTrackerData` from the top (the 4 base `Promise.all` queries) through the `usersMap` construction (the block that currently ends at `usersMap.set(u.id, u.name ?? "User")` and the following `myOfferIds`/`myRequestIds` lines) with:

```ts
async function fetchTrackerData(userId: string) {
  const result = await getTrackerData();
  const data = result.data;
  if (!data) return { offerList: [] as TrackerOffer[], requestList: [] as TrackerRequest[] };
  const { offerBidGroups, reqBidGroups, bidOfferGroups, bidReqGroups, userNames } = data;

  const myOfferIds = new Set(offerBidGroups.map((g) => g.offer.id));
  const myRequestIds = new Set(reqBidGroups.map((g) => g.req.id));

  // ...existing mapping below stays IDENTICAL, except read names from `userNames[...]`...
```

(The `userId` param is now unused by the fetch itself — keep the signature; the aggregate derives the user server-side. The `useEffect` call site `fetchTrackerData(currentUser.id)` is unchanged.)

- [ ] **Step 3: Point the mapping at `userNames`**

In the preserved mapping block (owned-offer cards, bid-on-offer cards, owned-request cards, bid-on-request cards), replace every `usersMap.get(<x>) ?? "User"` with `userNames[<x>] ?? "User"`. There are four occurrences (bidder in owned offers, owner in bid-on offers, bidder in owned requests, owner in bid-on requests). No other line in the mapping changes.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors; no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/tracker/page.tsx"
git commit -m "perf(tracker): consume getTrackerData (1 round-trip, no client fan-out)"
```

---

### Task 6: Chat — parallelize + pass name/avatar/deal-done as props

**Files:**
- Modify: `components/chat-room.tsx`
- Modify: `app/(protected)/chat/page.tsx`

**Interfaces:**
- Produces: `ChatRoom` gains optional props `otherName?: string`, `otherAvatarUrl?: string`, `dealDone?: boolean`. When supplied, the room uses them instead of fetching `getUsers`/`getDealStatus`; when absent, it falls back to fetching (so nothing breaks). Chat page passes the values it already has.

- [ ] **Step 1: Add props to `ChatRoom`**

In `components/chat-room.tsx`, extend `ChatRoomProps`:

```ts
interface ChatRoomProps {
  other_user_id: string;
  request_bid_id?: string | null;
  offer_bid_id?: string | null;
  disabled?: boolean;
  otherName?: string;
  otherAvatarUrl?: string;
  dealDone?: boolean;
}
```

Add them to the destructured params: `otherName, otherAvatarUrl, dealDone,`.

- [ ] **Step 2: Use the name/avatar props in `loadData` (skip the getUsers fetch when provided)**

In `loadData`, replace the `getUsers({ id: other_user_id })` block with a prop-or-fetch branch. After the `getConversation` handling:

```ts
      if (otherName !== undefined) {
        setOtherUserName(otherName || "Unknown User");
        setOtherAvatarUrl(otherAvatarUrl);
      } else {
        const result2 = await getUsers({ id: other_user_id });
        if (result2.data && result2.data.length > 0) {
          setOtherUserName(result2.data[0].name || "Unknown User");
          setOtherAvatarUrl(result2.data[0].avatar_url ?? undefined);
        }
      }

      setChatDataLoading(false);
```

Add `otherName`, `otherAvatarUrl` to the `loadData` effect's dependency array.

- [ ] **Step 3: Use the `dealDone` prop in the rating-gate effect (skip getDealStatus when provided)**

In the "Check if user already left a review" effect, rewrite the body so `isCompleted` comes from the `dealDone` prop when provided, else falls back to the existing `getDealStatus` logic:

```ts
  useEffect(() => {
    if (!bid_id) return;
    (async () => {
      let isCompleted: boolean;
      if (dealDone !== undefined) {
        isCompleted = dealDone;
      } else {
        const statusResult = await getDealStatus(bid_id, dealKind);
        isCompleted =
          dealKind === "request"
            ? statusResult.data?.parentStatus === "Completed"
            : statusResult.data?.parentStatus === "Closed";
      }

      if (isCompleted) {
        const reviewsResult = await getReviews({
          creator_id: publicUser.id,
          ...(request_bid_id
            ? { request_bid_id }
            : { offer_bid_id: offer_bid_id! }),
        });
        const alreadyReviewed = (reviewsResult.data ?? []).length > 0;
        setHasReviewed(alreadyReviewed);
        if (!alreadyReviewed) setRatingOpen(true);
      }
    })();
  }, [bid_id, dealKind, publicUser.id, request_bid_id, offer_bid_id, dealDone]);
```

(The page's `isDone` equals this `isCompleted` — request done ⇒ `parentStatus === "Completed"`, offer done ⇒ `parentStatus === "Closed"` — so passing `dealDone={isDone}` is behavior-preserving.)

- [ ] **Step 4: Pass the props from the chat page**

In `app/(protected)/chat/page.tsx`, pass the already-fetched values into `<ChatRoom>`:

```tsx
        <ChatRoom
          other_user_id={otherId}
          offer_bid_id={kind === "offer" ? bidId : null}
          request_bid_id={kind === "request" ? bidId : null}
          disabled={isDone}
          otherName={otherName}
          otherAvatarUrl={otherAvatarUrl ?? undefined}
          dealDone={isDone}
        />
```

(`otherName`, `otherAvatarUrl`, and `isDone` are existing state on the page. `otherName` starts as `""` and updates after the page's fetch — passing `""` initially is fine: the room shows "Unknown User" until it updates, same as the old fetch-timing behavior. This removes the room's duplicate `getUsers`/`getDealStatus` calls.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat-room.tsx "app/(protected)/chat/page.tsx"
git commit -m "perf(chat): pass name/avatar/deal-done to room, drop duplicate/serial fetches"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the new unit tests**

Run: `npm test -- __tests__/lib/batch.test.ts __tests__/lib/tracker.test.ts`
Expected: all pass.

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint lib/batch.ts lib/tracker.ts lib/validation/offers.ts lib/validation/requests.ts lib/repo/offers.repo.ts lib/repo/requests.repo.ts lib/db/schema.ts lib/services/tracker.service.ts lib/actions/tracker.ts "app/(protected)/tracker/page.tsx" components/chat-room.tsx "app/(protected)/chat/page.tsx"
```
Expected: 0 errors from these files.

- [ ] **Step 3: Manual QA**

- [ ] Tracker renders identically to before: owned offers/requests with their bidders, offers/requests you bid on (excluding your own), counterparty names, bid statuses, unread badges, and the chat-list modal — verify at mobile + widescreen.
- [ ] Network panel: opening the tracker fires **one** `getTrackerData` action (not ~21 get* calls).
- [ ] A user with zero owned posts and zero bids sees an empty tracker without errors (empty-batch path returns `[]`, no table scan / no crash).
- [ ] Chat: the header + message avatars show the other user; opening a chat no longer double-fetches `getUsers`/`getDealStatus` (one each at most, from the page); the rating modal still auto-opens after a deal is marked done and not already reviewed.

---

## Notes / dependencies

- **No migration** — behavior + perf only. `SelectRequest`/`SelectRequestBid` are type exports, not schema changes.
- **Parity is the acceptance bar:** the tracker's `offerList`/`requestList` mapping is unchanged; `getTrackerData` returns the exact groupings the client used to build via fan-out, plus `userNames`. If any card differs, the aggregation grouping is wrong — compare against `git stash` of the old page.
- Deferred (not this epic): the `requireAuth` per-action amplifier, tracker pagination/virtualization.
