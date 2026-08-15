# Closing System Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the request/offer closing transitions authorized, idempotent, atomic, and responsive, and stop the auto-expiry cron from closing bids on active listings.

**Architecture:** Ownership is enforced in whichever layer already holds the data — the action for `completeOfferBid` (it already fetches bid and offer), the service for `completeRequest` (via a new `callerId` parameter), the repo `WHERE` clause for withdraw/reopen. The three writes in `completeRequest` collapse into one transactional repo function whose `.returning()` yields the true loser set. Display-name lookups move inside `runAfterResponse`, since they are only ever consumed there.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM over Supabase Postgres (transaction-mode pooler, `prepare: false`), Jest, Zod.

**Spec:** `docs/superpowers/specs/2026-08-15-closing-system-remediation-design.md`

## Global Constraints

- Branch from `dev`, not `prod`: `git checkout dev && git pull origin dev && git checkout -b feature/closing-system-remediation`.
- Schema changes use `npx drizzle-kit push` — never `generate` or `migrate`. Task 5 needs no push (see its note).
- Run `npm format` before any push.
- Baseline is **20 suites / 120 tests green**. Every task ends green.
- Throw `AppError`, never bare `Error`, for anything the user should read: `handleAction` surfaces `AppError.message` verbatim and collapses everything else to "Something went wrong".
- Any UI change must hold at mobile (1 col), tablet (2 col), and desktop (3 col).
- Do not change `completeOfferBid`'s no-op on the parent offer's status — offers are standing listings and survive completed bids.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/repo/requests.repo.ts` | Modify | Add `completeRequestAtomic`, `updateRequestBidStatusForBidder` |
| `lib/repo/offers.repo.ts` | Modify | Add `updateOfferBidStatusForBidder` |
| `lib/services/requests.service.ts` | Modify | Ownership + idempotency guards; delegate to atomic repo fn |
| `lib/services/offers.service.ts` | Modify | Thread `bidderId`; stop nulling `imgUrl` |
| `lib/actions/deals.ts` | Modify | Ownership on `completeOfferBid`; defer name lookups |
| `lib/actions/offers.ts`, `lib/actions/requests.ts` | Modify | Pass `user.id` into withdraw/reopen |
| `lib/db/schema.ts` | Modify | `$onUpdate` on `offers`/`requests` `updated_at` |
| `app/(protected)/chat/page.tsx` | Modify | Pending state; review eligibility; loser banner |
| `components/chat-room.tsx` | Modify | Accept `reviewEligible` prop |
| `__tests__/lib/services/requests.service.test.ts` | **Create** | Ownership, idempotency, loser-set |
| `__tests__/lib/actions/deals.test.ts` | Modify | Non-owner rejection cases |

Tasks 1–7 are backend and test-covered. Tasks 8–9 are UI; the repo has no component-test harness (all 20 suites are `lib/` + `app/auth`), so they carry manual verification steps instead of assertions. Do not add a React testing stack for them.

---

### Task 1: Ownership + idempotency on `completeOfferBid`

The action already fetches the bid and the offer, so both guards are free.

**Files:**
- Modify: `lib/actions/deals.ts:94-126`
- Test: `__tests__/lib/actions/deals.test.ts`

**Interfaces:**
- Consumes: `requireAuth()` → `{ id: string }`; existing `offersService.getOfferBids` / `getOffers` mocks.
- Produces: no signature change. `completeOfferBid(bidId: string)` still returns `{ data: { success: true }, error: null }` on success.

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe("completeOfferBid", …)` block in `__tests__/lib/actions/deals.test.ts`:

```ts
    it("rejects a caller who does not own the offer", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Pending" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "someone-else", title: "Calculus notes", status: "Active" },
      ]);

      const result = await completeOfferBid("bid-1");

      expect(result.error).toBe("Only the offer owner can mark this done");
      expect(offersService.completeOfferBid).not.toHaveBeenCalled();
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it("rejects a bid that is already completed", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Completed" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "user-owner", title: "Calculus notes", status: "Active" },
      ]);

      const result = await completeOfferBid("bid-1");

      expect(result.error).toBe("This deal is already marked done");
      expect(offersService.completeOfferBid).not.toHaveBeenCalled();
    });
```

The existing happy-path test above them has no `status` on its bid fixture. Add `status: "Pending"` to it so it keeps passing once the idempotency guard lands.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- __tests__/lib/actions/deals.test.ts`
Expected: FAIL — both new tests get `"success"`-shaped data and `error: null`, because no guard exists yet.

- [ ] **Step 3: Implement the guards**

In `lib/actions/deals.ts`, add to the imports:

```ts
import { AppError } from "@/lib/error/app-error";
```

Replace the body of `completeOfferBid` (lines 94-126) with:

```ts
export async function completeOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new AppError("Offer bid not found", 404);
    if (bid.status === "Completed")
      throw new AppError("This deal is already marked done", 409);

    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new AppError("Offer not found", 404);
    if (offer.user_id !== user.id)
      throw new AppError("Only the offer owner can mark this done", 403);

    await offersService.completeOfferBid(bidId);

    // Deferred — the name lookup feeds the push body only, so it must not sit
    // on the critical path.
    runAfterResponse(async () => {
      const offererUsers = await usersService.getUsers({
        id: offer.user_id ?? undefined,
      });
      const offererName = offererUsers[0]?.name ?? "Someone";

      await sendPushToUser(bid.bidder_id, "offer_bid_completed", {
        title: "Deal confirmed!",
        body: `${offererName} marked your deal on ${offer.title} as done.`,
        url: `/chat?bidId=${bidId}&kind=offer&otherId=${offer.user_id}&title=${encodeURIComponent(offer.title)}`,
        contextId: null,
      });
    });

    return { success: true };
  });
}
```

This also delivers the latency fix for this action: `getUsers` was awaited before the response but consumed only inside `runAfterResponse`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- __tests__/lib/actions/deals.test.ts`
Expected: PASS, including the pre-existing happy path.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/deals.ts __tests__/lib/actions/deals.test.ts
git commit -m "fix(security): enforce offer ownership on completeOfferBid"
```

---

### Task 2: Scope withdraw/reopen to the bid's own bidder

Four actions authenticate and then update an arbitrary bid id. Scoping the `WHERE` clause makes the check and the write one query.

**Files:**
- Modify: `lib/repo/offers.repo.ts` (after `updateOfferBidStatus`, line 119)
- Modify: `lib/repo/requests.repo.ts` (after `updateRequestBidStatus`, line 129)
- Modify: `lib/services/offers.service.ts:54-60`, `lib/services/requests.service.ts:80-86`
- Modify: `lib/actions/offers.ts:56-68`, `lib/actions/requests.ts:56-68`
- Test: `__tests__/lib/actions/offers.test.ts`, `__tests__/lib/actions/requests.test.ts`

**Interfaces:**
- Produces: `offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, status)`, `requestsRepo.updateRequestBidStatusForBidder(bidId, bidderId, status)`. Service signatures become `withdrawOfferBid(bidId, bidderId)`, `reopenOfferBid(bidId, bidderId)`, `withdrawRequestBid(bidId, bidderId)`, `reopenRequestBid(bidId, bidderId)`. **Action signatures are unchanged** — all four still take `(bidId: string)` and derive the bidder from `requireAuth()`, so the four call sites in `app/(protected)/tracker/page.tsx` and `app/(protected)/(home)/page.tsx` need no edit.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/actions/offers.test.ts`, following the mocking style already in that file:

```ts
  describe("bid ownership scoping", () => {
    it("withdrawOfferBid scopes to the authenticated bidder", async () => {
      (offersService.withdrawOfferBid as jest.Mock).mockResolvedValue(undefined);

      await withdrawOfferBid("bid-1");

      expect(offersService.withdrawOfferBid).toHaveBeenCalledWith("bid-1", "user-owner");
    });

    it("reopenOfferBid scopes to the authenticated bidder", async () => {
      (offersService.reopenOfferBid as jest.Mock).mockResolvedValue(undefined);

      await reopenOfferBid("bid-1");

      expect(offersService.reopenOfferBid).toHaveBeenCalledWith("bid-1", "user-owner");
    });
  });
```

Import `withdrawOfferBid` and `reopenOfferBid` from `@/lib/actions/offers` at the top of that file if they are not already imported, and confirm the file's `requireAuth` mock resolves to an object whose `id` is `"user-owner"` — if it uses a different id, use that id in the assertions instead.

Add the mirrored pair to `__tests__/lib/actions/requests.test.ts` for `withdrawRequestBid` and `reopenRequestBid`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- __tests__/lib/actions/offers.test.ts __tests__/lib/actions/requests.test.ts`
Expected: FAIL — "called with 1 argument" vs the expected 2.

- [ ] **Step 3: Add the scoped repo functions**

In `lib/repo/offers.repo.ts`, after `updateOfferBidStatus`:

```ts
/**
 * Set an offer_bid's status, scoped to its own bidder.
 *
 * The bidder_id predicate is the authorization check: a caller who does not own
 * the bid matches zero rows and transitions nothing.
 */
export async function updateOfferBidStatusForBidder(
  bidId: string,
  bidderId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(offer_bids)
    .set({ status })
    .where(and(eq(offer_bids.id, bidId), eq(offer_bids.bidder_id, bidderId)));
}
```

In `lib/repo/requests.repo.ts`, after `updateRequestBidStatus`:

```ts
/**
 * Set a request_bid's status, scoped to its own bidder.
 *
 * The bidder_id predicate is the authorization check: a caller who does not own
 * the bid matches zero rows and transitions nothing.
 */
export async function updateRequestBidStatusForBidder(
  bidId: string,
  bidderId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(and(eq(request_bids.id, bidId), eq(request_bids.bidder_id, bidderId)));
}
```

Both files already import `and` and `eq` from `drizzle-orm`.

- [ ] **Step 4: Thread `bidderId` through the services**

In `lib/services/offers.service.ts`, replace lines 54-60:

```ts
export async function withdrawOfferBid(bidId: string, bidderId: string) {
  return await offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, "Closed");
}

export async function reopenOfferBid(bidId: string, bidderId: string) {
  return await offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, "Pending");
}
```

In `lib/services/requests.service.ts`, replace lines 80-86:

```ts
export async function withdrawRequestBid(bidId: string, bidderId: string) {
  return await requestsRepo.updateRequestBidStatusForBidder(bidId, bidderId, "Closed");
}

export async function reopenRequestBid(bidId: string, bidderId: string) {
  return await requestsRepo.updateRequestBidStatusForBidder(bidId, bidderId, "Pending");
}
```

- [ ] **Step 5: Pass the caller from the actions**

In `lib/actions/offers.ts`, replace lines 56-68:

```ts
export async function withdrawOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.withdrawOfferBid(bidId, user.id);
  });
}

export async function reopenOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return offersService.reopenOfferBid(bidId, user.id);
  });
}
```

Apply the identical shape to `withdrawRequestBid` / `reopenRequestBid` in `lib/actions/requests.ts` lines 56-68, calling `requestsService`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, 20 suites. Existing `updateOfferBidStatus` / `updateRequestBidStatus` stay in the repos — Task 3 still uses the unscoped variant for the winner transition, which is authorized at the request level instead.

- [ ] **Step 7: Commit**

```bash
git add lib/repo/offers.repo.ts lib/repo/requests.repo.ts lib/services/offers.service.ts lib/services/requests.service.ts lib/actions/offers.ts lib/actions/requests.ts __tests__/lib/actions/offers.test.ts __tests__/lib/actions/requests.test.ts
git commit -m "fix(security): scope bid withdraw/reopen to the owning bidder"
```

---

### Task 3: Atomic, authorized, idempotent `completeRequest` with a correct loser set

One transaction replaces three unguarded sequential writes. `.returning()` on the bulk close yields exactly the bids this call transitioned, which both excludes previously-withdrawn bidders and makes a repeat call a no-op.

**Files:**
- Modify: `lib/repo/requests.repo.ts` (add `completeRequestAtomic`)
- Modify: `lib/services/requests.service.ts:48-66`
- Test: **Create** `__tests__/lib/services/requests.service.test.ts`

**Interfaces:**
- Consumes: `requestsRepo.findRequestById(id)`, `requestsRepo.findRequestBidById(id)` (both already exist).
- Produces: `requestsRepo.completeRequestAtomic(requestId, winningBidId, ownerId)` → `Promise<{ closedLosers: { id: string; bidder_id: string }[] }>`. Service becomes `completeRequest(requestId, winningBidId, callerId)` → `Promise<{ winnerBid, loserBids, request }>` where `loserBids` is `{ id, bidder_id }[]`. Task 4 consumes this signature.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/services/requests.service.test.ts`:

```ts
import * as requestsService from "@/lib/services/requests.service";
import * as requestsRepo from "@/lib/repo/requests.repo";

jest.mock("@/lib/repo/requests.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/broadcast.service");

const OWNER = "user-owner";
const activeRequest = {
  id: "req-1",
  user_id: OWNER,
  title: "Need a pen",
  status: "Active",
};

describe("requestsService.completeRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(activeRequest);
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
      id: "bid-win",
      request_id: "req-1",
      bidder_id: "bidder-win",
      status: "Pending",
    });
    (requestsRepo.completeRequestAtomic as jest.Mock).mockResolvedValue({
      closedLosers: [{ id: "bid-lose", bidder_id: "bidder-lose" }],
    });
  });

  it("completes the request for its owner and returns the closed losers", async () => {
    const result = await requestsService.completeRequest("req-1", "bid-win", OWNER);

    expect(requestsRepo.completeRequestAtomic).toHaveBeenCalledWith(
      "req-1",
      "bid-win",
      OWNER,
    );
    expect(result.winnerBid.bidder_id).toBe("bidder-win");
    expect(result.loserBids).toEqual([{ id: "bid-lose", bidder_id: "bidder-lose" }]);
    expect(result.request).toEqual(activeRequest);
  });

  it("rejects a caller who does not own the request", async () => {
    await expect(
      requestsService.completeRequest("req-1", "bid-win", "someone-else"),
    ).rejects.toThrow("Only the requester can mark this done");

    expect(requestsRepo.completeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a request that is already completed", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.completeRequest("req-1", "bid-win", OWNER),
    ).rejects.toThrow("This request is already completed");

    expect(requestsRepo.completeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a winning bid belonging to a different request", async () => {
    (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
      id: "bid-win",
      request_id: "req-OTHER",
      bidder_id: "bidder-win",
      status: "Pending",
    });

    await expect(
      requestsService.completeRequest("req-1", "bid-win", OWNER),
    ).rejects.toThrow("That bid is not on this request");

    expect(requestsRepo.completeRequestAtomic).not.toHaveBeenCalled();
  });

  it("does not treat a previously withdrawn bidder as a loser", async () => {
    // The atomic close only returns rows it actually transitioned from Pending,
    // so a bid the bidder withdrew earlier is absent from closedLosers.
    (requestsRepo.completeRequestAtomic as jest.Mock).mockResolvedValue({
      closedLosers: [],
    });

    const result = await requestsService.completeRequest("req-1", "bid-win", OWNER);

    expect(result.loserBids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- __tests__/lib/services/requests.service.test.ts`
Expected: FAIL — `requestsRepo.completeRequestAtomic is not a function`, and the current 2-argument service ignores `callerId` entirely.

- [ ] **Step 3: Add the atomic repo function**

In `lib/repo/requests.repo.ts`, add after `bulkCloseRequestBids` (line 146):

```ts
/**
 * Complete a request in one transaction: close every other still-Pending bid,
 * mark the winner, then flip the request itself.
 *
 * The request UPDATE is scoped to `ownerId`, so a caller who does not own the
 * row transitions nothing. Returns only the bids this call moved out of
 * Pending — bids the bidder withdrew earlier were already Closed and are
 * correctly absent, which is what makes the loser notification set accurate and
 * a repeat call a no-op.
 */
export async function completeRequestAtomic(
  requestId: string,
  winningBidId: string,
  ownerId: string,
): Promise<{ closedLosers: { id: string; bidder_id: string }[] }> {
  return await db.transaction(async (tx) => {
    const closedLosers = await tx
      .update(request_bids)
      .set({ status: "Closed" })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          eq(request_bids.status, "Pending"),
          ne(request_bids.id, winningBidId),
        ),
      )
      .returning({ id: request_bids.id, bidder_id: request_bids.bidder_id });

    await tx
      .update(request_bids)
      .set({ status: "Completed" })
      .where(eq(request_bids.id, winningBidId));

    await tx
      .update(requests)
      .set({ status: "Completed", completed_at: new Date() })
      .where(and(eq(requests.id, requestId), eq(requests.user_id, ownerId)));

    return { closedLosers };
  });
}
```

`and`, `eq`, and `ne` are already imported in this file. `db.transaction` is safe here: the client runs against the transaction-mode pooler with `prepare: false` (`lib/db/index.ts:14-18`).

- [ ] **Step 4: Rewrite the service**

Replace `lib/services/requests.service.ts:48-66` with:

```ts
export async function completeRequest(
  requestId: string,
  winningBidId: string,
  callerId: string,
) {
  const req = await requestsRepo.findRequestById(requestId);
  if (!req) throw new AppError("Request not found", 404);
  if (req.user_id !== callerId)
    throw new AppError("Only the requester can mark this done", 403);
  if (req.status === "Completed")
    throw new AppError("This request is already completed", 409);

  const winnerBid = await requestsRepo.findRequestBidById(winningBidId);
  if (!winnerBid || winnerBid.request_id !== requestId)
    throw new AppError("That bid is not on this request", 400);

  const { closedLosers } = await requestsRepo.completeRequestAtomic(
    requestId,
    winningBidId,
    callerId,
  );

  // Return winner/loser bids for notification dispatch by caller
  return { winnerBid, loserBids: closedLosers, request: req };
}
```

`AppError` is already imported at line 6. `requestsRepo.bulkCloseRequestBids` is now unused by this path — leave it in place; nothing else calls it and removing it is unrelated churn.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- __tests__/lib/services/requests.service.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Confirm the rest of the suite still builds**

Run: `npm test`
Expected: `__tests__/lib/actions/deals.test.ts` now FAILS — its `completeRequest` test asserts a 2-argument call, and the action has not been updated yet. That is expected and is Task 4's job. Every other suite passes.

- [ ] **Step 7: Commit**

```bash
git add lib/repo/requests.repo.ts lib/services/requests.service.ts __tests__/lib/services/requests.service.test.ts
git commit -m "fix(deals): make completeRequest atomic, authorized, and idempotent"
```

---

### Task 4: Wire the action and take the name lookup off the critical path

**Files:**
- Modify: `lib/actions/deals.ts:52-92`
- Test: `__tests__/lib/actions/deals.test.ts`

**Interfaces:**
- Consumes: `requestsService.completeRequest(requestId, winningBidId, callerId)` from Task 3, returning `loserBids: { id, bidder_id }[]`.
- Produces: no signature change — `completeRequest(requestId, winningBidId)` still returns `{ data: { success: true }, error: null }`.

- [ ] **Step 1: Update the existing test and add a non-owner case**

In `__tests__/lib/actions/deals.test.ts`, inside `describe("completeRequest", …)`, change the existing assertion:

```ts
      expect(mockCompleteRequest).toHaveBeenCalledWith("req-1", "bid-1", "user-owner");
```

and add:

```ts
    it("surfaces the service's authorization error", async () => {
      const { AppError } = jest.requireActual("@/lib/error/app-error");
      (requestsService.completeRequest as jest.Mock).mockRejectedValue(
        new AppError("Only the requester can mark this done", 403),
      );

      const result = await completeRequest("req-1", "bid-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Only the requester can mark this done");
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- __tests__/lib/actions/deals.test.ts`
Expected: FAIL — the call is still made with 2 arguments.

- [ ] **Step 3: Rewrite the action**

Replace `lib/actions/deals.ts:52-92` with:

```ts
export async function completeRequest(requestId: string, winningBidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const { winnerBid, loserBids, request } =
      await requestsService.completeRequest(requestId, winningBidId, user.id);

    // Deferred — must not hold up the action response. The requester's display
    // name is read here rather than above because it feeds the push bodies
    // only, and the loser fan-out scales with bid count.
    runAfterResponse(async () => {
      const requesterUsers = await usersService.getUsers({
        id: request.user_id ?? undefined,
      });
      const requesterName = requesterUsers[0]?.name ?? "Someone";

      await Promise.allSettled([
        ...(winnerBid
          ? [
              sendPushToUser(winnerBid.bidder_id, "request_completed_winner", {
                title: "Your offer was accepted!",
                body: `${requesterName} marked your bid on ${request.title} as done.`,
                url: `/chat?bidId=${winningBidId}&kind=request&otherId=${request.user_id}&title=${encodeURIComponent(request.title)}`,
                contextId: null,
              }),
            ]
          : []),
        ...loserBids.map((loser) =>
          sendPushToUser(loser.bidder_id, "request_completed_loser", {
            title: "Request fulfilled",
            body: `${request.title} has been fulfilled by someone else.`,
            url: `/`,
            contextId: null,
          }),
        ),
      ]);
    });

    return { success: true };
  });
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, all suites including the two repaired in Task 3 Step 6.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/deals.ts __tests__/lib/actions/deals.test.ts
git commit -m "perf(deals): defer requester name lookup past the response"
```

---

### Task 5: Bump `updated_at` when a listing is edited

Drizzle's `$onUpdate` is a runtime default applied to the generated UPDATE statement. It emits **no DDL**, so this task needs no `drizzle-kit push`.

**Files:**
- Modify: `lib/db/schema.ts:100` (requests), `lib/db/schema.ts:117` (offers)

**Interfaces:**
- Produces: every `db.update()` against `offers` or `requests` now writes `updated_at`. Task 6 relies on this being in place.

- [ ] **Step 1: Add the runtime default**

In `lib/db/schema.ts`, in the `requests` table, change:

```ts
  updated_at: timestamp("updated_at").notNull().defaultNow(),
```

to:

```ts
  // $onUpdate keeps the 14-day expiry cron honest: expireStaleRequestBids
  // measures staleness against this column, so it must mean "last touched",
  // not "created".
  updated_at: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
```

Apply the identical change to the `offers` table.

- [ ] **Step 2: Verify no DDL drift was introduced**

Run: `npx drizzle-kit push`
Expected: reports **no schema changes to apply**. If it proposes any DDL, stop — something other than `$onUpdate` was edited.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS, 20 suites.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "fix(schema): bump offers/requests updated_at on write"
```

---

### Task 6: Treat a new bid as activity on its parent listing

`$onUpdate` alone only covers edits. The expiry cron's intent is "no activity for 14 days", and a fresh bid is activity.

**Files:**
- Modify: `lib/services/offers.service.ts:42-44` (`createOfferBid`)
- Modify: `lib/services/requests.service.ts:44-46` (`createRequestBid`)
- Test: `__tests__/lib/services/requests.service.test.ts`

**Interfaces:**
- Consumes: `requestsRepo.updateRequest(id, data, userId)`, `offersRepo.updateOffer(id, data, userId)` — both already exist and are already owner-scoped, so the parent's own `user_id` is passed.
- Produces: no signature change.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/services/requests.service.test.ts`:

```ts
describe("requestsService.createRequestBid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestsRepo.insertRequestBid as jest.Mock).mockResolvedValue({
      id: "bid-new",
      request_id: "req-1",
      bidder_id: "bidder-new",
    });
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(activeRequest);
  });

  it("touches the parent request so the expiry clock resets", async () => {
    await requestsService.createRequestBid({
      request_id: "req-1",
      bidder_id: "bidder-new",
    });

    expect(requestsRepo.updateRequest).toHaveBeenCalledWith("req-1", {}, OWNER);
  });

  it("still returns the bid when the parent lookup finds nothing", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    const bid = await requestsService.createRequestBid({
      request_id: "req-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", request_id: "req-1", bidder_id: "bidder-new" });
    expect(requestsRepo.updateRequest).not.toHaveBeenCalled();
  });
});
```

The empty `{}` payload is deliberate — `$onUpdate` from Task 5 supplies `updated_at`, so no column needs to be named. `updated_at` is not in `updateRequestSchema`'s pick list (`lib/validation/requests.ts:58-69`), so it cannot be passed explicitly through this type anyway.

**Verify before trusting the empty payload:** drizzle must expand `.set({})` into `SET updated_at = $1` via `$onUpdate` rather than rejecting an empty SET clause. Confirm against a real database before finishing this task:

```bash
node -e "require('dotenv').config({path:'.env'});const{db}=require('./lib/db');const{requests}=require('./lib/db/schema');const{eq}=require('drizzle-orm');db.update(requests).set({}).where(eq(requests.id,'<paste-a-real-request-id>')).then(()=>console.log('ok')).catch(e=>console.error('FAILED:',e.message))"
```

If it errors, the empty-object approach is out: add `updated_at` to the repo call by widening `updateRequest`'s parameter type to `Partial<typeof requests.$inferInsert>` (matching how `offersRepo.updateOffer` is already typed at `lib/repo/offers.repo.ts:99-108`) and pass `{ updated_at: new Date() }` explicitly. Update the test's expected argument to match whichever path you take.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- __tests__/lib/services/requests.service.test.ts`
Expected: FAIL — `updateRequest` is never called.

- [ ] **Step 3: Implement the touch**

Replace `lib/services/requests.service.ts:44-46` with:

```ts
export async function createRequestBid(data: InsertRequestBidSchema) {
  const bid = await requestsRepo.insertRequestBid(data);

  // A new bid is activity: reset the parent's staleness clock so
  // expireStaleRequestBids does not close live bids on a busy old request.
  // Best-effort — a failed touch must never fail the bid.
  try {
    const req = await requestsRepo.findRequestById(data.request_id);
    if (req?.user_id) await requestsRepo.updateRequest(data.request_id, {}, req.user_id);
  } catch {
    // Staleness bookkeeping only.
  }

  return bid;
}
```

Apply the mirrored change to `lib/services/offers.service.ts:42-44`:

```ts
export async function createOfferBid(data: InsertOfferBidSchema) {
  const bid = await offersRepo.insertOfferBid(data);

  // A new bid is activity: reset the parent's staleness clock so
  // expireStaleOfferBids does not close live bids on a busy old offer.
  // Best-effort — a failed touch must never fail the bid.
  try {
    const offer = await offersRepo.findOfferById(data.offer_id);
    if (offer?.user_id) await offersRepo.updateOffer(data.offer_id, {}, offer.user_id);
  } catch {
    // Staleness bookkeeping only.
  }

  return bid;
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, 20 suites plus the new service suite.

- [ ] **Step 5: Commit**

```bash
git add lib/services/requests.service.ts lib/services/offers.service.ts __tests__/lib/services/requests.service.test.ts
git commit -m "fix(bids): treat a new bid as activity on its parent listing"
```

---

### Task 7: Stop discarding the image when an offer closes

Per decision D2 in the spec. Nulling `imgUrl` destroys the only pointer while leaving the storage object orphaned.

**Files:**
- Modify: `lib/services/offers.service.ts:62-77`

**Interfaces:**
- Produces: no signature change. `editOffer` no longer needs the local `updatePayload` variable.

**No new test.** The existing `closeOffer` action test in `__tests__/lib/actions/deals.test.ts:114-132` mocks `offersService.closeOffer`, so the null-ing sits below the mocked boundary and no action-level assertion can observe it. Testing it properly would mean a repo-level integration test against a live database, which this repo has no harness for. Verified manually in Step 2 instead.

- [ ] **Step 1: Remove the null-ing**

Replace `lib/services/offers.service.ts:62-77` with:

```ts
export async function editOffer(
  id: string,
  data: UpdateOfferSchema,
  userId: string,
) {
  return await offersRepo.updateOffer(id, { ...data }, userId);
}

export async function closeOffer(id: string, userId: string) {
  await offersRepo.updateOffer(id, { status: "Closed" }, userId);
  await offersRepo.closeOfferBids(id);
}
```

The `offers` import at `lib/services/offers.service.ts:2` and the `updatePayload` local both become unused — remove the import line and let `npm run lint` confirm nothing else referenced it.

- [ ] **Step 2: Verify manually**

Run `npm run dev`, create an offer with a photo, close it from the tracker, then open the tracker's history section. Expected: the closed offer still renders its photo. Check at mobile width and desktop width.

- [ ] **Step 3: Run lint and the suite**

Run: `npm run lint && npm test`
Expected: no unused-import error, 20+ suites pass.

- [ ] **Step 4: Commit**

```bash
git add lib/services/offers.service.ts
git commit -m "fix(offers): keep the listing image when an offer closes"
```

---

### Task 8: Give the chat "Mark done" button a pending state

This is the click the user perceives as frozen. It is also the second half of the duplicate-notification bug — Task 3 closed the server-side hole, this closes the client-side one.

**Files:**
- Modify: `app/(protected)/chat/page.tsx:88-101` and `:153-161`

**Interfaces:**
- Consumes: `completeOfferBid(bidId)`, `completeRequest(parentId, bidId)` — unchanged signatures.
- Produces: no exported change.

- [ ] **Step 1: Add the pending state**

In `app/(protected)/chat/page.tsx`, add alongside the other `useState` calls near line 35:

```tsx
  const [isMarkingDone, setIsMarkingDone] = useState(false);
```

Replace `handleMarkDone` (lines 88-101) with:

```tsx
  const handleMarkDone = async () => {
    if (isMarkingDone) return;
    if (!window.confirm("Mark this deal as done?")) return;

    setIsMarkingDone(true);
    try {
      const result =
        kind === "offer"
          ? await completeOfferBid(bidId)
          : await completeRequest(parentId, bidId);

      if (result.error) {
        alert(result.error);
        return;
      }
      setIsDone(true);
      setJustMarkedDone(true);
    } finally {
      setIsMarkingDone(false);
    }
  };
```

`alert(result.error)` replaces the hardcoded "Failed. Please try again." — the server now sends real messages ("This request is already completed", "Only the requester can mark this done") and `handleAction` passes `AppError.message` through verbatim.

- [ ] **Step 2: Disable the button while in flight**

Replace the button at lines 153-161 with:

```tsx
        {isOwner && !isDone && (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={isMarkingDone}
            className="shrink-0 text-xs font-medium border border-gray-400 rounded px-3 py-1.5 text-gray-600 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMarkingDone ? "Marking…" : "Mark done"}
          </button>
        )}
```

- [ ] **Step 3: Verify manually**

Run `npm run dev`. Open a chat you own with a pending bid and click "Mark done", then immediately click again. Expected: the button greys to "Marking…" and ignores the second click; exactly one completion notification arrives. Confirm the header still lays out correctly at mobile width — "Marking…" is one character wider than "Mark done".

Then click "Mark done" on an already-completed deal via a stale tab. Expected: the alert reads "This deal is already marked done", not "Failed. Please try again."

- [ ] **Step 4: Run lint and the suite**

Run: `npm run lint && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/chat/page.tsx"
git commit -m "fix(chat): guard Mark done against double submission"
```

---

### Task 9: Prompt only the winning bidder to review

Per decision D1. Chat read-only stays keyed to the parent request; review eligibility becomes its own signal keyed to the bid.

**Files:**
- Modify: `app/(protected)/chat/page.tsx:32-86`, `:180-191`
- Modify: `components/chat-room.tsx:36-47`, `:199-226`

**Interfaces:**
- Produces: `ChatRoom` gains an optional prop `reviewEligible?: boolean`. When provided it replaces `dealDone` as the review gate; `dealDone` continues to control the read-only/disabled behaviour. When `reviewEligible` is omitted, `ChatRoom` falls back to its existing self-fetch via `getDealStatus`, so any other call site keeps working unchanged.

- [ ] **Step 1: Track the bid's own status on the chat page**

In `app/(protected)/chat/page.tsx`, add near line 34:

```tsx
  const [isWinner, setIsWinner] = useState(false);
```

Inside the `getDealStatus` handler, replace lines 56-63 with:

```tsx
        // Read-only keys off the parent for requests: once fulfilled, no thread
        // on it should still accept messages. Review eligibility keys off this
        // bid — a losing bidder had no transaction to review.
        const done =
          kind === "offer"
            ? statusResult.data.bidStatus === "Completed"
            : statusResult.data.parentStatus === "Completed";
        if (done) setIsDone(true);
        if (statusResult.data.bidStatus === "Completed") setIsWinner(true);
```

- [ ] **Step 2: Give losers an accurate banner**

Replace the `bannerText` block at lines 80-86 with:

```tsx
  const bannerText = isDone
    ? justMarkedDone
      ? "This deal has been marked done."
      : kind === "request"
        ? isWinner
          ? "This deal has been marked done."
          : "This request was fulfilled by someone else."
        : "This offer is closed."
    : null;
```

- [ ] **Step 3: Pass the new signal down**

In the same file, add the prop to `<ChatRoom>` at lines 182-190:

```tsx
          dealDone={isDone}
          reviewEligible={isWinner || justMarkedDone}
```

`justMarkedDone` covers the owner who just completed the deal in this session, whose `isWinner` was never set by the initial fetch.

- [ ] **Step 4: Consume it in ChatRoom**

In `components/chat-room.tsx`, add to the props type near line 38:

```tsx
  reviewEligible?: boolean;
```

and to the destructured parameters near line 47:

```tsx
  reviewEligible,
```

Replace the effect at lines 199-226 with:

```tsx
  // Check if user already left a review for this deal
  useEffect(() => {
    if (!bid_id) return;
    (async () => {
      let eligible: boolean;
      if (reviewEligible !== undefined) {
        eligible = reviewEligible;
      } else if (dealDone !== undefined) {
        eligible = dealDone;
      } else {
        const statusResult = await getDealStatus(bid_id, dealKind);
        // Keyed off the bid, not the parent: on a request, only the winning
        // bidder transacted.
        eligible = statusResult.data?.bidStatus === "Completed";
      }

      if (eligible) {
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
  }, [
    bid_id,
    dealKind,
    publicUser.id,
    request_bid_id,
    offer_bid_id,
    dealDone,
    reviewEligible,
  ]);
```

Note the self-fetch fallback also changes from `parentStatus` to `bidStatus` for requests — same rule, applied consistently.

- [ ] **Step 5: Verify manually**

Needs three accounts, or two plus a seeded bid. Post a request from account A. Bid on it from B and from C. From A, open the chat with B and mark it done.

Expected:
- **B (winner):** chat read-only, banner "This deal has been marked done.", review modal opens.
- **C (loser):** chat read-only, banner "This request was fulfilled by someone else.", **no review modal**, and no duplicate bell rows.
- **A (owner):** banner "This deal has been marked done." in the thread they completed.

Check the banner wraps cleanly at mobile width — the loser string is the longest of the three.

- [ ] **Step 6: Run lint and the suite**

Run: `npm run lint && npm test`
Expected: clean, 20+ suites.

- [ ] **Step 7: Format and commit**

```bash
npm format
git add "app/(protected)/chat/page.tsx" components/chat-room.tsx
git commit -m "fix(reviews): prompt only the winning bidder after completion"
```

---

## Final verification

- [ ] `npm run lint && npm test` — expect 21+ suites green (20 baseline + the new service suite).
- [ ] `npx drizzle-kit push` — expect no pending DDL.
- [ ] `npm format`
- [ ] Push and open a PR into `dev`:

```bash
git push -u origin feature/closing-system-remediation
```

## Deliberately not in this plan

- `Busy` / `Cancelled` dead enum values, and the missing "close a request without a winner" path. Product design, not defect repair.
- `requireAuth()`'s per-action network round-trip. App-wide; belongs to Epic F.
- Storage bucket cleanup for deleted offers (task #19).
- A React component-test harness. Tasks 8 and 9 are verified manually by design.
