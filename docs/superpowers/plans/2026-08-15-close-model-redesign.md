# Close Model Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace winner-selection on requests with a single `[Close request]` action, add `[Dismiss]` for offer inquiries, and make `Completed` the sole signal for review eligibility.

**Architecture:** One transactional repo function resolves every bid on a closing request: `Pending` bids with at least one message become `Completed` (reviewable both ways), the rest become `Closed`. The request lands on `Completed` if anyone converted, `Cancelled` if nobody did. Winner/loser notification types retire in favour of one uniform `request_closed`. Offers keep their existing two-level model and gain a per-inquiry dismiss.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM over Supabase Postgres (transaction-mode pooler, `prepare: false`), Jest, Zod, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-15-close-model-redesign-design.md`

## Global Constraints

- **Work directly on `dev` in the main checkout.** No feature branch, no worktree. Commit per task.
- Package manager is **`pnpm`**. `pnpm test`, `pnpm lint`. There is **no `format` script** — do not run one. Ignore any `npm ...` guidance in CLAUDE.md.
- **Baseline: 22 suites / 161 tests passing; `pnpm lint` reports exactly 2 errors** (`jest.config.js` `require()`, and one react-hooks `set-state-in-effect`). Every task ends at or above that, with no third lint error.
- **No schema change and no `drizzle-kit push` in this plan.** `notifications.type` is a plain `text` column and the completion types have no row in `notification_preferences`, so notification changes are Zod-array edits only. If a task appears to need DDL, stop and report.
- Throw **`AppError`** (`@/lib/error/app-error`, constructor `(message, statusCode)`) for anything a user should read. `handleAction` surfaces `AppError.message` verbatim and collapses a bare `Error` to "Something went wrong".
- **A bid is reviewable, in both directions, iff its status is `Completed`.** This is the spec's single rule; no new column or flag may be introduced to express it.
- `completeOfferBid` must continue to leave the parent offer's status untouched — offers are standing listings that survive completed bids.
- Every UI change must hold at mobile (1 col), tablet (2 col), and desktop (3 col).
- Line numbers below are approximate. Locate edit sites by symbol name.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/validation/notifications.ts` | Modify | Retire 2 notification types, add 3 |
| `lib/services/push.service.ts` | Modify | Update `IN_APP_ONLY_TYPES` |
| `lib/repo/requests.repo.ts` | Modify | Replace `completeRequestAtomic` with `closeRequestAtomic` |
| `lib/repo/offers.repo.ts` | Modify | Add `dismissOfferBidForOwner`; add source-state guard for reopen |
| `lib/services/requests.service.ts` | Modify | `closeRequest`; reopen source-state guard |
| `lib/services/offers.service.ts` | Modify | `dismissOfferBid`; `closeOffer` returns affected bidders; reopen guard |
| `lib/actions/deals.ts` | Modify | `closeRequest` action, uniform notification loop; `dismissOfferBid` action |
| `app/(protected)/tracker/page.tsx` | Modify | `Cancelled` filing, real Close button, Dismiss, relabels |
| `app/(protected)/chat/page.tsx` | Modify | Close-request confirmation, banner copy, review signal |
| `components/chat-room.tsx` | Modify | `reviewEligible` prop |
| `__tests__/lib/services/requests.service.test.ts` | Modify | Append — file exists with 3 describes |
| `__tests__/lib/services/offers.service.test.ts` | Modify | Append — file exists with 3 describes |
| `__tests__/lib/actions/deals.test.ts` | Modify | Rewrite completion tests for the new shape |

Tasks 1–7 are backend and test-covered. Tasks 8–9 are UI; this repo has **no component-test harness** (all 22 suites are `lib/` + `app/auth`) and one must **not** be introduced. Those tasks carry static-verification steps instead. Browser QA is Niles's, not the implementer's — never start a dev server.

---

### Task 1: Retire winner/loser notification types

**Files:**
- Modify: `lib/validation/notifications.ts`
- Modify: `lib/services/push.service.ts`

**Interfaces:**
- Produces: `NotificationType` gains `"request_closed"`, `"offer_bid_dismissed"`, `"offer_closed"` and loses `"request_completed_winner"`, `"request_completed_loser"`. Tasks 4, 5, 6 consume these exact strings.

- [ ] **Step 1: Update the type union**

In `lib/validation/notifications.ts`, replace the `NOTIFICATION_TYPES` array with:

```ts
export const NOTIFICATION_TYPES = [
  "new_inquiry",
  "new_message",
  "new_request",
  "new_offer",
  "new_review",
  "request_closed",
  "offer_bid_completed",
  "offer_bid_dismissed",
  "offer_closed",
  "bid_expired",
] as const;
```

- [ ] **Step 2: Update the in-app-only set**

In `lib/services/push.service.ts`, replace the `IN_APP_ONLY_TYPES` block (and its doc comment) with:

```ts
/**
 * Informational events: they belong in the bell, but none of them is actionable
 * enough to justify an OS-level interrupt.
 *  - offer_bid_dismissed: the owner closed a thread that went nowhere
 *  - offer_closed: the listing shut; nothing to do but move on
 *  - bid_expired: batched housekeeping about a thread that went cold 14 days ago
 *  - new_review: worth knowing, not worth buzzing
 */
const IN_APP_ONLY_TYPES = new Set<NotificationType>([
  "offer_bid_dismissed",
  "offer_closed",
  "bid_expired",
  "new_review",
]);
```

`request_closed` is deliberately absent — it prompts a review, so it pushes.

- [ ] **Step 3: Find every remaining reference to the retired types**

Run: `grep -rn "request_completed_winner\|request_completed_loser" lib app components __tests__`

Expected at this point: hits in `lib/actions/deals.ts` and `__tests__/lib/actions/deals.test.ts` only. Those are Task 4's job — **leave them**. If a hit appears anywhere else, report it and stop.

- [ ] **Step 4: Confirm typecheck shows only the expected breakage**

Run: `npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`

Expected: errors in `lib/actions/deals.ts` about the removed union members, and nothing else. (Pre-existing errors in `offers.test.ts` / `requests.test.ts` are posts→offers rename leftovers, filtered out above.)

- [ ] **Step 5: Commit**

```bash
git add lib/validation/notifications.ts lib/services/push.service.ts
git commit -m "refactor(notifications): retire winner/loser types for request_closed"
```

Tests will still pass at this step — `deals.test.ts` mocks the push service, so the string change does not break it. The type error is real and Task 4 clears it.

---

### Task 2: `closeRequestAtomic` — resolve every bid in one transaction

**Files:**
- Modify: `lib/repo/requests.repo.ts`

**Interfaces:**
- Produces: `closeRequestAtomic(requestId: string, ownerId: string): Promise<{ completed: {id, bidder_id}[]; silent: {id, bidder_id}[]; finalStatus: "Completed" | "Cancelled" | null }>`. `finalStatus` is `null` when the caller does not own the request and nothing was written. Task 3 consumes this.
- Removes: `completeRequestAtomic`.

- [ ] **Step 1: Add the imports**

`lib/repo/requests.repo.ts` currently imports `{ and, eq, lte, ilike, gte, desc, ne, lt, inArray }` from `drizzle-orm` and `{ requests, request_bids }` from `../db/schema`. Add `exists` and `sql` to the drizzle import, and `messages` to the schema import. Leave `ne` — other functions still use it.

- [ ] **Step 2: Replace `completeRequestAtomic`**

Delete `completeRequestAtomic` entirely and add:

```ts
/**
 * Close a request and resolve every bid on it, in one transaction, scoped to
 * the owner.
 *
 * Pending bids that have at least one message become Completed — that is the
 * notify-and-review set. Whatever remains Pending had no conversation and
 * becomes Closed, which is why the second statement needs no message
 * predicate: the first already claimed everything that qualified. Doing the
 * message check in SQL keeps it inside the transaction, so a message arriving
 * mid-close cannot produce an inconsistent result.
 *
 * Bids the bidder withdrew earlier are already Closed and are therefore
 * untouched and unreported, which is what keeps the notification set honest.
 *
 * Returns finalStatus null and writes nothing when the caller does not own the
 * request.
 */
export async function closeRequestAtomic(
  requestId: string,
  ownerId: string,
): Promise<{
  completed: { id: string; bidder_id: string }[];
  silent: { id: string; bidder_id: string }[];
  finalStatus: "Completed" | "Cancelled" | null;
}> {
  return await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: requests.id })
      .from(requests)
      .where(and(eq(requests.id, requestId), eq(requests.user_id, ownerId)));

    if (owned.length === 0)
      return { completed: [], silent: [], finalStatus: null };

    const completed = await tx
      .update(request_bids)
      .set({ status: "Completed" })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          eq(request_bids.status, "Pending"),
          exists(
            tx
              .select({ one: sql`1` })
              .from(messages)
              .where(eq(messages.request_bid_id, request_bids.id)),
          ),
        ),
      )
      .returning({ id: request_bids.id, bidder_id: request_bids.bidder_id });

    const silent = await tx
      .update(request_bids)
      .set({ status: "Closed" })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          eq(request_bids.status, "Pending"),
        ),
      )
      .returning({ id: request_bids.id, bidder_id: request_bids.bidder_id });

    const finalStatus = completed.length > 0 ? "Completed" : "Cancelled";

    await tx
      .update(requests)
      .set({
        status: finalStatus,
        ...(finalStatus === "Completed" ? { completed_at: new Date() } : {}),
      })
      .where(and(eq(requests.id, requestId), eq(requests.user_id, ownerId)));

    return { completed, silent, finalStatus };
  });
}
```

`completed_at` is written only on `Completed` — a cancelled request was never completed and must not carry a completion timestamp.

- [ ] **Step 3: Verify the correlated subquery is right**

Run: `grep -n "messages.request_bid_id, request_bids.id" lib/repo/requests.repo.ts`

Expected: one hit. The `exists` subquery must correlate `messages.request_bid_id` against the **outer** `request_bids.id`. A subquery comparing against a literal or against `messages.id` would match every row and complete every silent bid — verify by eye, not just by grep.

- [ ] **Step 4: Confirm the expected typecheck breakage**

Run: `npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`

Expected: `lib/services/requests.service.ts` errors on the now-missing `completeRequestAtomic`, plus the Task 1 errors in `deals.ts`. Both are cleared by Tasks 3 and 4.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/requests.repo.ts
git commit -m "feat(requests): closeRequestAtomic resolves all bids in one transaction"
```

---

### Task 3: `closeRequest` service

**Files:**
- Modify: `lib/services/requests.service.ts`
- Test: `__tests__/lib/services/requests.service.test.ts` (exists — **append** a describe; do not overwrite; do not duplicate its module-scope `jest.mock` calls or its `OWNER` / `activeRequest` constants)

**Interfaces:**
- Consumes: `requestsRepo.closeRequestAtomic(requestId, ownerId)` from Task 2.
- Produces: `closeRequest(requestId: string, callerId: string): Promise<{ completed: {id, bidder_id}[]; request: SelectRequest; finalStatus: "Completed" | "Cancelled" }>`. Task 4 consumes this. `completeRequest` is removed.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/services/requests.service.test.ts`:

```ts
describe("requestsService.closeRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(activeRequest);
    (requestsRepo.closeRequestAtomic as jest.Mock).mockResolvedValue({
      completed: [{ id: "bid-a", bidder_id: "bidder-a" }],
      silent: [{ id: "bid-b", bidder_id: "bidder-b" }],
      finalStatus: "Completed",
    });
  });

  it("closes the request and returns only the conversing bidders", async () => {
    const result = await requestsService.closeRequest("req-1", OWNER);

    expect(requestsRepo.closeRequestAtomic).toHaveBeenCalledWith("req-1", OWNER);
    expect(result.completed).toEqual([{ id: "bid-a", bidder_id: "bidder-a" }]);
    expect(result.finalStatus).toBe("Completed");
  });

  it("reports Cancelled when nobody conversed", async () => {
    (requestsRepo.closeRequestAtomic as jest.Mock).mockResolvedValue({
      completed: [],
      silent: [],
      finalStatus: "Cancelled",
    });

    const result = await requestsService.closeRequest("req-1", OWNER);

    expect(result.finalStatus).toBe("Cancelled");
    expect(result.completed).toEqual([]);
  });

  it("rejects a caller who does not own the request", async () => {
    await expect(
      requestsService.closeRequest("req-1", "someone-else"),
    ).rejects.toThrow("Only the requester can close this");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a request that is already closed", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
      ...activeRequest,
      status: "Completed",
    });

    await expect(
      requestsService.closeRequest("req-1", OWNER),
    ).rejects.toThrow("This request is already closed");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });

  it("rejects a request that does not exist", async () => {
    (requestsRepo.findRequestById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      requestsService.closeRequest("req-1", OWNER),
    ).rejects.toThrow("Request not found");

    expect(requestsRepo.closeRequestAtomic).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- __tests__/lib/services/requests.service.test.ts`
Expected: FAIL — `requestsService.closeRequest is not a function`.

- [ ] **Step 3: Replace `completeRequest` with `closeRequest`**

Delete the whole `completeRequest` function and add:

```ts
export async function closeRequest(requestId: string, callerId: string) {
  const req = await requestsRepo.findRequestById(requestId);
  if (!req) throw new AppError("Request not found", 404);
  if (req.user_id !== callerId)
    throw new AppError("Only the requester can close this", 403);
  if (req.status !== "Active")
    throw new AppError("This request is already closed", 409);

  const { completed, finalStatus } = await requestsRepo.closeRequestAtomic(
    requestId,
    callerId,
  );

  // finalStatus is only null when the ownership predicate matched nothing,
  // which the check above already ruled out.
  return { completed, request: req, finalStatus: finalStatus ?? "Cancelled" };
}
```

`AppError` is already imported in this file. The `silent` set is intentionally discarded — those bidders never conversed and are not notified.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm test -- __tests__/lib/services/requests.service.test.ts`
Expected: PASS, 5 new tests.

- [ ] **Step 5: Commit**

```bash
git add lib/services/requests.service.ts __tests__/lib/services/requests.service.test.ts
git commit -m "feat(requests): closeRequest replaces winner-selection completion"
```

---

### Task 4: `closeRequest` action with a uniform notification loop

**Files:**
- Modify: `lib/actions/deals.ts`
- Test: `__tests__/lib/actions/deals.test.ts`

**Interfaces:**
- Consumes: `requestsService.closeRequest(requestId, callerId)` from Task 3.
- Produces: `closeRequest(requestId: string)` server action returning `{ success: true }`. Tasks 8 and 9 call it. `completeRequest` is removed.

- [ ] **Step 1: Rewrite the tests**

In `__tests__/lib/actions/deals.test.ts`, replace the entire `describe("completeRequest", ...)` block with:

```ts
  describe("closeRequest", () => {
    it("closes the request and notifies every conversing bidder", async () => {
      (requestsService.closeRequest as jest.Mock).mockResolvedValue({
        completed: [
          { id: "bid-a", bidder_id: "bidder-a" },
          { id: "bid-b", bidder_id: "bidder-b" },
        ],
        request: { id: "req-1", title: "Need a pen", user_id: "user-owner" },
        finalStatus: "Completed",
      });

      const result = await closeRequest("req-1");

      expect(result.data).toEqual({ success: true });
      expect(requestsService.closeRequest).toHaveBeenCalledWith("req-1", "user-owner");
      expect(pushService.sendPushToUser).toHaveBeenCalledTimes(2);
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-a",
        "request_closed",
        expect.objectContaining({ title: "Request closed" }),
      );
    });

    it("sends nothing when nobody conversed", async () => {
      (requestsService.closeRequest as jest.Mock).mockResolvedValue({
        completed: [],
        request: { id: "req-1", title: "Need a pen", user_id: "user-owner" },
        finalStatus: "Cancelled",
      });

      const result = await closeRequest("req-1");

      expect(result.data).toEqual({ success: true });
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it("surfaces the service's authorization error", async () => {
      const { AppError } = jest.requireActual("@/lib/error/app-error");
      (requestsService.closeRequest as jest.Mock).mockRejectedValue(
        new AppError("Only the requester can close this", 403),
      );

      const result = await closeRequest("req-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Only the requester can close this");
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });
  });
```

Update the file's import from `@/lib/actions/deals` to pull in `closeRequest` instead of `completeRequest`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- __tests__/lib/actions/deals.test.ts`
Expected: FAIL — `closeRequest is not a function`.

- [ ] **Step 3: Replace the action**

Delete `completeRequest` from `lib/actions/deals.ts` and add:

```ts
export async function closeRequest(requestId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const { completed, request } = await requestsService.closeRequest(
      requestId,
      user.id,
    );

    // Deferred — the name lookup feeds the notification bodies only, and the
    // fan-out scales with the number of conversations.
    runAfterResponse(async () => {
      if (completed.length === 0) return;

      const requesterUsers = await usersService.getUsers({
        id: request.user_id ?? undefined,
      });
      const requesterName = requesterUsers[0]?.name ?? "Someone";

      await Promise.allSettled(
        completed.map((bid) =>
          sendPushToUser(bid.bidder_id, "request_closed", {
            title: "Request closed",
            body: `${requesterName} closed ${request.title}. Leave a review.`,
            url: `/chat?bidId=${bid.id}&kind=request&otherId=${request.user_id}&title=${encodeURIComponent(request.title)}`,
            contextId: null,
          }),
        ),
      );
    });

    return { success: true };
  });
}
```

Every recipient gets the same message and a deep link to **their own** thread — note `bid.id`, not a shared id.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 5: Confirm the type errors from Tasks 1–2 are gone**

Run: `npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/deals.ts __tests__/lib/actions/deals.test.ts
git commit -m "feat(requests): one uniform request_closed notification per thread"
```

---

### Task 5: `[Dismiss]` an offer inquiry

**Files:**
- Modify: `lib/repo/offers.repo.ts`
- Modify: `lib/services/offers.service.ts`
- Modify: `lib/actions/deals.ts`
- Test: `__tests__/lib/services/offers.service.test.ts` (exists — **append**)

**Interfaces:**
- Produces: `offersRepo.dismissOfferBidForOwner(bidId, ownerId): Promise<boolean>`; `offersService.dismissOfferBid(bidId, ownerId): Promise<boolean>`; `dismissOfferBid(bidId: string)` server action. Task 8 calls the action.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/services/offers.service.test.ts`:

```ts
describe("offersService.dismissOfferBid", () => {
  beforeEach(() => jest.clearAllMocks());

  it("dismisses through the owner-scoped repo fn", async () => {
    (offersRepo.dismissOfferBidForOwner as jest.Mock).mockResolvedValue(true);

    const ok = await offersService.dismissOfferBid("bid-1", "owner-1");

    expect(ok).toBe(true);
    expect(offersRepo.dismissOfferBidForOwner).toHaveBeenCalledWith("bid-1", "owner-1");
  });

  it("reports false when the caller does not own the offer", async () => {
    (offersRepo.dismissOfferBidForOwner as jest.Mock).mockResolvedValue(false);

    const ok = await offersService.dismissOfferBid("bid-1", "someone-else");

    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- __tests__/lib/services/offers.service.test.ts`
Expected: FAIL — `offersService.dismissOfferBid is not a function`.

- [ ] **Step 3: Add the scoped repo function**

In `lib/repo/offers.repo.ts` (which already imports `exists` and `sql`), add next to `completeOfferBidForOwner`:

```ts
/**
 * Close a pending offer bid without completing it, scoped to the parent
 * offer's owner. Check and write in one statement. Returns false when the
 * caller does not own the offer or the bid is no longer Pending.
 */
export async function dismissOfferBidForOwner(
  bidId: string,
  ownerId: string,
): Promise<boolean> {
  const rows = await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(offer_bids.id, bidId),
        eq(offer_bids.status, "Pending"),
        exists(
          db
            .select({ one: sql`1` })
            .from(offers)
            .where(
              and(eq(offers.id, offer_bids.offer_id), eq(offers.user_id, ownerId)),
            ),
        ),
      ),
    )
    .returning({ id: offer_bids.id });

  return rows.length > 0;
}
```

- [ ] **Step 4: Add the service wrapper**

In `lib/services/offers.service.ts`:

```ts
export async function dismissOfferBid(bidId: string, ownerId: string) {
  return await offersRepo.dismissOfferBidForOwner(bidId, ownerId);
}
```

- [ ] **Step 5: Add the action**

In `lib/actions/deals.ts`, mirroring `completeOfferBid`'s shape:

```ts
export async function dismissOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new AppError("Offer bid not found", 404);

    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new AppError("Offer not found", 404);

    const dismissed = await offersService.dismissOfferBid(bidId, user.id);
    if (!dismissed) {
      if (offer.user_id !== user.id)
        throw new AppError("Only the offer owner can dismiss this", 403);
      throw new AppError("This inquiry is no longer open", 409);
    }

    runAfterResponse(() =>
      sendPushToUser(bid.bidder_id, "offer_bid_dismissed", {
        title: "Inquiry closed",
        body: `Your inquiry on ${offer.title} was closed.`,
        url: `/`,
        contextId: null,
      }),
    );

    return { success: true };
  });
}
```

- [ ] **Step 6: Run the suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/repo/offers.repo.ts lib/services/offers.service.ts lib/actions/deals.ts __tests__/lib/services/offers.service.test.ts
git commit -m "feat(offers): dismiss a single inquiry without closing the offer"
```

---

### Task 6: Tell pending inquirers when an offer closes

**Files:**
- Modify: `lib/repo/offers.repo.ts` (`closeOfferAtomic`)
- Modify: `lib/services/offers.service.ts` (`closeOffer`)
- Modify: `lib/actions/deals.ts` (`closeOffer`)
- Test: `__tests__/lib/services/offers.service.test.ts` (append)

**Interfaces:**
- Produces: `closeOfferAtomic(offerId, ownerId)` now returns `{ closed: boolean; affected: {id, bidder_id}[] }` instead of `boolean`; `offersService.closeOffer(id, userId)` returns `{id, bidder_id}[]` and still throws 403 on non-ownership.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/services/offers.service.test.ts`:

```ts
describe("offersService.closeOffer notification set", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the bidders whose pending inquiries were closed", async () => {
    (offersRepo.closeOfferAtomic as jest.Mock).mockResolvedValue({
      closed: true,
      affected: [{ id: "bid-1", bidder_id: "bidder-1" }],
    });

    const affected = await offersService.closeOffer("offer-1", "owner-1");

    expect(affected).toEqual([{ id: "bid-1", bidder_id: "bidder-1" }]);
  });

  it("throws and returns nobody when the caller does not own the offer", async () => {
    (offersRepo.closeOfferAtomic as jest.Mock).mockResolvedValue({
      closed: false,
      affected: [],
    });

    await expect(
      offersService.closeOffer("offer-1", "someone-else"),
    ).rejects.toThrow("Only the offer owner can close this");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- __tests__/lib/services/offers.service.test.ts`
Expected: FAIL — the current mock returns a boolean and `closeOffer` returns void.

**Also expect two PRE-EXISTING tests in that same file to break in this task**, in the `describe("offers.service closeOffer", ...)` block: they mock `closeOfferAtomic` as resolving `true` / `false` because that was its old return type. Update those two mocks to `{ closed: true, affected: [] }` and `{ closed: false, affected: [] }`. Do not delete or weaken their assertions — the 403-on-false behaviour they check must survive this change unaltered.

- [ ] **Step 3: Return the affected bidders from the repo**

In `lib/repo/offers.repo.ts`, change `closeOfferAtomic`'s bid-closing statement to add `.returning({ id: offer_bids.id, bidder_id: offer_bids.bidder_id })`, change the return type to `Promise<{ closed: boolean; affected: { id: string; bidder_id: string }[] }>`, return `{ closed: false, affected: [] }` on the non-owner path, and `{ closed: true, affected }` otherwise.

- [ ] **Step 4: Thread it through the service**

```ts
export async function closeOffer(id: string, userId: string) {
  const { closed, affected } = await offersRepo.closeOfferAtomic(id, userId);
  if (!closed) throw new AppError("Only the offer owner can close this", 403);
  return affected;
}
```

- [ ] **Step 5: Notify from the action**

In `lib/actions/deals.ts`, replace the body of `closeOffer` with:

```ts
export async function closeOffer(offerId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const affected = await offersService.closeOffer(offerId, user.id);

    runAfterResponse(async () => {
      if (affected.length === 0) return;

      const offersList = await offersService.getOffers({ id: offerId });
      const title = offersList[0]?.title ?? "an offer";

      await Promise.allSettled(
        affected.map((bid) =>
          sendPushToUser(bid.bidder_id, "offer_closed", {
            title: "Offer closed",
            body: `${title} is no longer available.`,
            url: `/`,
            contextId: null,
          }),
        ),
      );
    });

    return { success: true };
  });
}
```

The offer title is fetched inside `runAfterResponse` because it feeds the body only.

- [ ] **Step 6: Run the suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/repo/offers.repo.ts lib/services/offers.service.ts lib/actions/deals.ts __tests__/lib/services/offers.service.test.ts
git commit -m "feat(offers): notify pending inquirers when an offer closes"
```

---

### Task 7: Reopen must check the bid's own state, not just the parent's

**Files:**
- Modify: `lib/services/offers.service.ts` (`reopenOfferBid`)
- Modify: `lib/services/requests.service.ts` (`reopenRequestBid`)
- Test: both service test files (append)

**Interfaces:**
- Produces: no signature change. Both reopen services gain a source-state guard.

Both already reject when the parent is not `Active`. Neither checks the bid's own status, so a `Completed` bid can be flipped back to `Pending` — undoing a transaction and its review eligibility.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/services/offers.service.test.ts`:

```ts
describe("offersService.reopenOfferBid source state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue({
      id: "offer-1",
      user_id: "owner-1",
      status: "Active",
    });
  });

  it("refuses to reopen a completed bid", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
      id: "bid-1",
      offer_id: "offer-1",
      bidder_id: "bidder-1",
      status: "Completed",
    });

    await expect(
      offersService.reopenOfferBid("bid-1", "bidder-1"),
    ).rejects.toThrow("A completed deal cannot be reopened");

    expect(offersRepo.updateOfferBidStatusForBidder).not.toHaveBeenCalled();
  });
});
```

Append the mirrored test to `__tests__/lib/services/requests.service.test.ts` using `requestsRepo.findRequestBidById` and `requestsRepo.updateRequestBidStatusForBidder`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test -- __tests__/lib/services/`
Expected: FAIL — no such guard, so the repo fn is called.

- [ ] **Step 3: Add the guard**

In `reopenOfferBid`, after the existing parent-status check and before the repo call:

```ts
  const bid = await offersRepo.findOfferBidById(bidId);
  if (!bid) throw new AppError("Offer bid not found", 404);
  if (bid.status === "Completed")
    throw new AppError("A completed deal cannot be reopened", 409);
```

Mirror in `reopenRequestBid` with `requestsRepo.findRequestBidById` and `"Request bid not found"`.

- [ ] **Step 4: Run the suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/offers.service.ts lib/services/requests.service.ts __tests__/lib/services/
git commit -m "fix(bids): a completed bid cannot be reopened"
```

---

### Task 8: Tracker — real Close button, Cancelled filing, Dismiss

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

**Interfaces:**
- Consumes: `closeRequest(requestId)` (Task 4), `dismissOfferBid(bidId)` (Task 5).

**No test.** This repo has no component-test harness and one must not be added. Verify statically per the steps below. **Do not start a dev server.**

- [ ] **Step 1: Fix the Close/Delete mislabel — this is a data-loss bug**

On the owned **request** card, `onDelete` currently calls `handleDeleteRequest` while `deleteLabel` reads `"Close"`. Delete cascades to bids, messages, and reviews. A requester clicking "Close" is destroying history.

Add a `handleCloseRequest` alongside the existing handlers:

```tsx
  const handleCloseRequest = (requestId: string) => {
    setConfirmModal({
      message:
        "Close this request? All open inquiries will be closed, and everyone you've spoken with can leave a review.",
      onConfirm: async () => {
        const { error } = await closeRequest(requestId);
        if (error) {
          alert(error);
          return;
        }
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, status: "Completed" } : r,
          ),
        );
      },
    });
  };
```

Then in `renderRequestCard`, point the owned branch at it:

```tsx
        onDelete={
          isHistory
            ? undefined
            : card.isOwned
              ? () => handleCloseRequest(card.id)
              : () => handleWithdrawRequestBid(card.rawBidId!)
        }
```

`handleDeleteRequest` stays — Task 9's note explains where Delete now lives. Import `closeRequest` from `@/lib/actions/deals` and drop the `completeRequest` import.

- [ ] **Step 2: File `Cancelled` requests into history**

`activeRequests` (posts tab) uses `status !== "Completed"` and `historyRequests` uses `status === "Completed"`, so a `Cancelled` request would sit in Active forever. Change the posts-tab branches to:

```tsx
      ? tabRequests.filter((r) => r.status === "Active")
```

and

```tsx
      ? tabRequests.filter((r) => r.status !== "Active")
```

Leave the inquiries-tab branches alone — they key off pending bids, which is still correct.

- [ ] **Step 3: Replace the request modal's per-bidder Mark done with nothing**

Requests no longer complete per-thread. In the `ChatListModal` wiring, the `modalData.type === "request"` branch of `onMarkDone` must be removed — pass `undefined` for requests. Keep the offer branch.

- [ ] **Step 4: Add Dismiss to offer inquiries**

Extend `ChatListModal`'s props with `onDismiss?: (bidId: string) => void`, render a small secondary "Dismiss" control next to each person row when it is provided, and wire it from the offer branch:

```tsx
              onDismiss={
                modalData.isHistory || modalData.type !== "offer"
                  ? undefined
                  : (bidId) => {
                      setConfirmModal({
                        message: "Dismiss this inquiry? No review will be exchanged.",
                        onConfirm: async () => {
                          const { error } = await dismissOfferBid(bidId);
                          if (error) {
                            alert(error);
                            return;
                          }
                          setModalData((prev) =>
                            prev
                              ? { ...prev, people: prev.people.filter((p) => p.bidId !== bidId) }
                              : null,
                          );
                        },
                      });
                    }
              }
```

Import `dismissOfferBid` from `@/lib/actions/deals`.

- [ ] **Step 5: Relabel offer completion**

Where the offer modal's action reads "Mark done", change the visible label to "Close transaction". Do not change the request side — it has no per-thread action any more.

- [ ] **Step 6: Verify statically**

Run: `pnpm lint && npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`
Expected: lint at 2 errors, no new ones; no type errors.

Run: `grep -n "completeRequest" app/\(protected\)/tracker/page.tsx`
Expected: no hits.

In your report, state: what the owned-request card's delete button now calls, what a `Cancelled` request now does in both tabs, and confirm the Dismiss control is hidden for history and for requests.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/tracker/page.tsx"
git commit -m "feat(tracker): real Close for requests, Dismiss for offer inquiries"
```

---

### Task 9: Chat — close the whole request, review only on Completed

**Files:**
- Modify: `app/(protected)/chat/page.tsx`
- Modify: `components/chat-room.tsx`

**Interfaces:**
- Consumes: `closeRequest(requestId)` (Task 4).
- Produces: `ChatRoom` gains `reviewEligible?: boolean`. When provided it replaces `dealDone` as the review gate; `dealDone` continues to control read-only. Omitted, `ChatRoom` falls back to its self-fetch, so other call sites keep working.

**No test** — no component harness. Verify statically. **Do not start a dev server.**

- [ ] **Step 1: Track the bid's own status**

In `app/(protected)/chat/page.tsx`, add beside the other `useState` calls:

```tsx
  const [isWinner, setIsWinner] = useState(false);
```

In the `getDealStatus` handler, after `setParentId(...)`, add:

```tsx
        if (statusResult.data.bidStatus === "Completed") setIsWinner(true);
```

Leave the existing `done` computation alone — read-only still keys off `parentStatus` for requests, which is correct: a closed request closes every thread.

- [ ] **Step 2: Point the button at `closeRequest`**

Replace the request branch of `handleMarkDone` so it calls `closeRequest(parentId)` rather than `completeRequest(parentId, bidId)`, and change the confirmation to name the blast radius:

```tsx
    const prompt =
      kind === "offer"
        ? "Close this transaction?"
        : "Close this request? All open inquiries will be closed, and everyone you've spoken with can leave a review.";
    if (!window.confirm(prompt)) return;
```

Keep the existing `isMarkingDone` guard, `try/finally`, and `alert(result.error)` exactly as they are. Update the import to `closeRequest`.

- [ ] **Step 3: Give losers an accurate banner**

Replace the `bannerText` computation with:

```tsx
  const bannerText = isDone
    ? justMarkedDone
      ? "This deal has been marked done."
      : kind === "request"
        ? isWinner
          ? "This request was closed. You can leave a review."
          : "This request was closed."
        : "This offer is closed."
    : null;
```

- [ ] **Step 4: Pass the review signal down**

On `<ChatRoom>`, beside `dealDone={isDone}`:

```tsx
          reviewEligible={isWinner || justMarkedDone}
```

- [ ] **Step 5: Consume it in ChatRoom**

Add `reviewEligible?: boolean;` to the props type and `reviewEligible,` to the destructured parameters. Replace the review effect's eligibility computation with:

```tsx
      let eligible: boolean;
      if (reviewEligible !== undefined) {
        eligible = reviewEligible;
      } else if (dealDone !== undefined) {
        eligible = dealDone;
      } else {
        const statusResult = await getDealStatus(bid_id, dealKind);
        // Keyed off the bid, not the parent: on a closed request, only the
        // threads that actually conversed reach Completed.
        eligible = statusResult.data?.bidStatus === "Completed";
      }
```

Add `reviewEligible` to the effect's dependency array.

- [ ] **Step 6: Verify statically**

Run: `pnpm lint && npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`
Expected: lint at 2 errors, no new ones; no type errors.

Run: `grep -rn "completeRequest" app components lib`
Expected: no hits anywhere.

Run: `pnpm test`
Expected: 22 suites passing.

In your report, state the banner text for each of the three request cases (owner who just closed, conversing bidder, silent bidder) and confirm the review modal cannot open for a bid whose status is `Closed`.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/chat/page.tsx" components/chat-room.tsx
git commit -m "feat(chat): close the whole request, review only on completed threads"
```

---

## Final verification

- [ ] `pnpm test` — 22 suites, ≥175 tests
- [ ] `pnpm lint` — exactly 2 errors, 13 warnings
- [ ] `npx tsc --noEmit` — only the two pre-existing test-file errors
- [ ] `grep -rn "request_completed_winner\|request_completed_loser\|completeRequest" lib app components __tests__` — no hits
- [ ] `git push origin dev`

## Deliberately not in this plan

- **Soft-delete and retention (Spec B).** Delete still cascades `requests` → `request_bids` → `messages` **and** `reviews`. `removeOfferBid`/`removeRequestBid` still let a bidder hard-delete a `Completed` bid and erase the review on it — the most exploitable hole in the system, and unchanged by this plan.
- **Where Delete lives in the UI.** Task 8 repoints the owned-request card's button from delete to close, which leaves Delete with no entry point on that card. Spec B owns re-siting it; until then a requester can close but not delete from the tracker.
- `Ongoing` (requests) and `Busy` (offers) remain declared and unwritten.
- The disclose-before-authorize ordering in the edit/reopen guards.
- `requireAuth()`'s per-action network round-trip — Epic F.
