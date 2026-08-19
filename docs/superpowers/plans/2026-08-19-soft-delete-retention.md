# Soft Delete & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Delete hide immediately and anonymize after 30 days, so it stops cascading away reviews in both directions and stops outliving its own evidence for reports.

**Architecture:** Five nullable `deleted_at` columns, plus a nullable `anonymized_at` on `requests` and `offers` marking rows the purge sweep has already stripped (a real column, not a magic `title` string, since the latter is user-settable and forgeable). Every read in the four affected repos gains a `notDeleted()` predicate, applied in the repo layer only. Delete paths become soft and cascade the tombstone explicitly, since `ON DELETE CASCADE` does not fire for an update. A fourth step in the `expire-bids` cron anonymizes listings and hard-deletes messages past the window, skipping anything an open report references. Bids persist as tombstones forever because reviews cascade from them. A source-level test then locks the read rule in place.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM over Supabase Postgres (transaction-mode pooler, `prepare: false`), Jest, Zod, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md`

## Global Constraints

- **Work directly on `dev` in the main checkout.** No feature branch, no worktree. **Verify `git branch --show-current` prints `dev` before every commit** — a commit in this repo already landed on `prod` once because the checkout had been switched externally.
- **Every task must leave the suite GREEN.** We commit straight to `dev` with no PR gate, so a red commit is a red integration branch for anyone who pulls. This plan is ordered to make that possible; if a task cannot end green, stop and report rather than committing.
- Package manager is **`pnpm`**. `pnpm test`, `pnpm lint`. There is **no `format` script**.
- **Baseline: 22 suites / 168 tests passing.** `pnpm lint` reports exactly **2** errors (`jest.config.js` `require()`, one react-hooks `set-state-in-effect`). `npx tsc --noEmit` reports only pre-existing errors in `__tests__/lib/actions/offers.test.ts` and `__tests__/lib/actions/requests.test.ts`. Add nothing to any count.
- **This plan requires DDL and Niles runs it.** Task 1 adds the columns to `lib/db/schema.ts`; the live database will not have them until `pnpm drizzle-kit push` is run. **No task may run `drizzle-kit` or connect to a database.** Consequence, stated plainly: from Task 1 until that push, the app does not work against the live database even though the suite is green, because Jest mocks the repos. Verify by test and typecheck, never by running the app.
- **Retention window is 30 days**, as a single named constant — never a literal at a call site.
- **Reviews are never soft-deleted and never purged.** No task may add `deleted_at` to `reviews`. **No task may hard-delete a bid.**
- Throw **`AppError`** (`@/lib/error/app-error`, `(message, statusCode)`) for anything a user reads. `handleAction` surfaces `.message` verbatim; a bare `Error` collapses to "Something went wrong".
- Every UI change must hold at mobile (1 col), tablet (2 col), desktop (3 col).
- Line numbers are approximate. Locate edit sites by symbol name.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/db/schema.ts` | Modify | `deleted_at` on 5 tables; `anonymized_at` on `requests`, `offers` |
| `lib/repo/soft-delete.ts` | **Create** | `notDeleted()`, `RETENTION_DAYS`, `retentionCutoff()` |
| `lib/repo/messages.repo.ts` | Modify | Filter 4 reads; soft-delete `deleteMessage` |
| `lib/repo/offers.repo.ts` | Modify | Filter 5 reads + write-internal selects; soft delete + cascade |
| `lib/repo/requests.repo.ts` | Modify | Filter 5 reads + write-internal selects; soft delete + cascade |
| `lib/repo/relationships.repo.ts` | Modify | Filter `relationshipExists` |
| `lib/services/offers.service.ts`, `requests.service.ts` | Modify | Point remove* at the cascade |
| `__tests__/lib/repo/soft-delete-coverage.test.ts` | **Create** | The read-rule gate |
| `lib/supabase/storage.ts` | **Create** | Server-side bucket object delete |
| `lib/repo/reports.repo.ts` | Modify | `findOpenReportTargetIds` |
| `lib/repo/purge.repo.ts` | **Create** | The anonymize sweep |
| `app/api/cron/expire-bids/route.ts` | Modify | Fourth step: purge |
| `app/(protected)/tracker/page.tsx` | Modify | Re-site Delete |

Tasks 1–8 are backend and test-covered. Task 9 is UI; this repo has **no component-test harness** and one must **not** be added. Browser QA is Niles's — never start a dev server.

**Ordering note:** the read-rule gate (Task 6) deliberately comes *after* the filters it enforces, not before. Writing it first would mean four consecutive red commits on `dev`. Instead Task 6 must pass on arrival, and proves it is real by temporarily removing a filter and observing the failure.

---

### Task 1: `deleted_at` columns and the shared predicate

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/repo/soft-delete.ts`

**Interfaces:**
- Produces: `deleted_at: timestamp | null` on `requests`, `offers`, `request_bids`, `offer_bids`, `messages`; plus `notDeleted(table)`, `RETENTION_DAYS`, `retentionCutoff(now)`. Every later task consumes these.

- [ ] **Step 1: Add the columns**

In `lib/db/schema.ts`, add this to each of `requests`, `offers`, `request_bids`, `offer_bids`, and `messages`:

```ts
  // Soft delete. NULL means live.
  // See docs/superpowers/specs/2026-08-19-soft-delete-retention-design.md
  deleted_at: timestamp("deleted_at"),
```

Place it last in each table's column list. Do NOT add it to `reviews`, `users`, `notifications`, `reports`, `push_subscriptions`, or `notification_preferences`.

- [ ] **Step 2: Create the shared predicate**

Create `lib/repo/soft-delete.ts`:

```ts
import { isNull, type Column } from "drizzle-orm";

/**
 * Days a soft-deleted listing keeps its content before the expire-bids cron
 * anonymizes it. Decided 2026-08-19; see the spec's "Retention window" section.
 */
export const RETENTION_DAYS = 30;

/**
 * The one predicate that hides soft-deleted rows.
 *
 * Every exported read in messages/offers/requests/relationships.repo.ts must
 * call this — `__tests__/lib/repo/soft-delete-coverage.test.ts` enumerates those
 * modules' exports and fails if one does not. A single named helper, rather than
 * an inlined `isNull(x.deleted_at)`, is what makes that test possible.
 */
export function notDeleted(table: { deleted_at: Column }) {
  return isNull(table.deleted_at);
}

/** Cutoff for the anonymize sweep: rows soft-deleted before this are due. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"`
Expected: no output. If `notDeleted`'s parameter type does not satisfy drizzle's `isNull`, adjust the type — but keep the call site as `notDeleted(offers)`, taking the table rather than the column.

Do **not** run `drizzle-kit`. State in your report that the live database lacks these columns until Niles pushes.

- [ ] **Step 4: Suite green**

Run: `pnpm test`
Expected: 22 suites / 168 tests. Nothing reads the new column yet.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print dev
git add lib/db/schema.ts lib/repo/soft-delete.ts
git commit -m "feat(schema): deleted_at columns and the notDeleted predicate"
```

---

### Task 2: Filter `messages.repo.ts`

**Files:**
- Modify: `lib/repo/messages.repo.ts`

**Interfaces:**
- Consumes: `notDeleted` from Task 1.

- [ ] **Step 1: Add the predicate to all four reads**

Import `notDeleted` from `./soft-delete`, then add `notDeleted(messages)` to the `where` of each of: `findConversation`, `findMessages`, `findLatestTimestampsForBids`, `hasUserSentMessageInThread`.

Each already builds a `where` — either an `and(...)` or a single predicate. Where it is a single predicate, wrap both in `and(...)`; where it is already `and(...)`, append. `and` is already imported.

`findLatestTimestampsForBids` issues **two** parallel `db.select(...)` calls, one for offer bids and one for request bids. Both need it.

- [ ] **Step 2: Soft-delete `deleteMessage`**

```ts
export async function deleteMessage(id: string, userId: string) {
  return await db
    .update(messages)
    .set({ deleted_at: new Date() })
    .where(and(eq(messages.id, id), eq(messages.sender_id, userId)));
}
```

- [ ] **Step 3: Suite green, lint unchanged**

Run: `pnpm test && pnpm lint`
Expected: 22 suites / 168 tests green; lint exactly 2 errors. The existing message tests mock the db, so they should be unaffected — if any breaks, report which and why rather than adjusting the test to match.

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # must print dev
git add lib/repo/messages.repo.ts
git commit -m "feat(messages): hide soft-deleted messages from every read"
```

---

### Task 3: Filter and soft-delete `offers.repo.ts`

**Files:**
- Modify: `lib/repo/offers.repo.ts`

- [ ] **Step 1: Add the predicate to all five reads**

Import `notDeleted` from `./soft-delete`. Add to `findOfferById`, `findLatestOfferTimestamp`, `findOffers` (→ `notDeleted(offers)`) and `findOfferBidById`, `findOfferBids` (→ `notDeleted(offer_bids)`).

- [ ] **Step 2: Add it to the write-internal selects**

These are not `find*`, so Task 6's gate will not catch them — but a soft-deleted listing must not remain actionable:

- `closeOfferAtomic` — its `owned` select gains `notDeleted(offers)`, so a deleted offer cannot be closed.
- `expireStaleOfferBids` — its `stale` select joins `offers`; add `notDeleted(offers)` and `notDeleted(offer_bids)` so the cron does not fire `bid_expired` for deleted listings.
- `completeOfferBidForOwner` and `dismissOfferBidForOwner` — add `notDeleted(offer_bids)` to the outer `where` and `notDeleted(offers)` inside the `exists` subquery.
- `withdrawOfferBidForBidder` — add `notDeleted(offer_bids)`.

- [ ] **Step 3: Make both delete paths soft**

```ts
export async function deleteOffer(id: string, userId: string) {
  return await db
    .update(offers)
    .set({ deleted_at: new Date() })
    .where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

export async function deleteOfferBid(id: string, userId: string) {
  return await db
    .update(offer_bids)
    .set({ deleted_at: new Date() })
    .where(and(eq(offer_bids.id, id), eq(offer_bids.bidder_id, userId)));
}
```

This is what closes the review-erasure hole: with no hard `DELETE` on a bid, `reviews` can no longer cascade away.

- [ ] **Step 4: Add the cascading soft delete**

`ON DELETE CASCADE` does not fire for an update, so descendants must be tombstoned explicitly or a deleted offer's messages stay readable:

```ts
/**
 * Soft-delete an offer and everything under it, scoped to the owner.
 *
 * Bids are tombstoned, never removed — reviews cascade from them (spec D2), so
 * deleting one here would destroy exactly what soft delete exists to protect.
 * Returns false when the caller does not own the offer, having written nothing.
 */
export async function softDeleteOfferCascade(
  offerId: string,
  ownerId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const now = new Date();

    const owned = await tx
      .update(offers)
      .set({ deleted_at: now })
      .where(
        and(
          eq(offers.id, offerId),
          eq(offers.user_id, ownerId),
          notDeleted(offers),
        ),
      )
      .returning({ id: offers.id });

    if (owned.length === 0) return false;

    const bids = await tx
      .update(offer_bids)
      .set({ deleted_at: now })
      .where(and(eq(offer_bids.offer_id, offerId), notDeleted(offer_bids)))
      .returning({ id: offer_bids.id });

    if (bids.length > 0) {
      await tx
        .update(messages)
        .set({ deleted_at: now })
        .where(
          and(
            inArray(
              messages.offer_bid_id,
              bids.map((b) => b.id),
            ),
            notDeleted(messages),
          ),
        );
    }

    return true;
  });
}
```

`messages` and `inArray` must be imported — check what this file already has.

- [ ] **Step 5: Suite green, lint unchanged**

Run: `pnpm test && pnpm lint`
Expected: 22 suites green, lint 2 errors.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print dev
git add lib/repo/offers.repo.ts
git commit -m "feat(offers): soft-delete offers and bids, hide them from reads"
```

---

### Task 4: Filter and soft-delete `requests.repo.ts`

**Files:**
- Modify: `lib/repo/requests.repo.ts`

- [ ] **Step 1: Add the predicate to all five reads**

Import `notDeleted` from `./soft-delete`. Add to `findRequestById`, `findLatestRequestTimestamp`, `findRequests` (→ `notDeleted(requests)`) and `findRequestBidById`, `findRequestBids` (→ `notDeleted(request_bids)`).

- [ ] **Step 2: Add it to the write-internal selects**

- `closeRequestAtomic` — the `owned` select gains `notDeleted(requests)`; **and both bid `UPDATE`s gain `notDeleted(request_bids)`.** This one matters beyond visibility: without it a soft-deleted bid could be swept to `Completed`, and `Completed` is the sole signal for review eligibility. A deleted bid must never become reviewable.
- `expireStaleRequestBids` — add `notDeleted(requests)` and `notDeleted(request_bids)`.
- `withdrawRequestBidForBidder` — add `notDeleted(request_bids)`.

- [ ] **Step 3: Make both delete paths soft**

```ts
export async function deleteRequest(id: string, userId: string) {
  return await db
    .update(requests)
    .set({ deleted_at: new Date() })
    .where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}

export async function deleteRequestBid(id: string, userId: string) {
  return await db
    .update(request_bids)
    .set({ deleted_at: new Date() })
    .where(and(eq(request_bids.id, id), eq(request_bids.bidder_id, userId)));
}
```

- [ ] **Step 4: Add the cascading soft delete**

Mirror `softDeleteOfferCascade` exactly, as `softDeleteRequestCascade(requestId, ownerId)`, using `requests`, `request_bids`, and `messages.request_bid_id`. Same transaction shape, same owner scoping, same "bids tombstoned never removed" rule, same `false` return when unowned.

- [ ] **Step 5: Suite green, lint unchanged**

Run: `pnpm test && pnpm lint`
Expected: 22 suites green, lint 2 errors. `closeRequestAtomic` has 5 existing service tests — they mock the repo, so they should be untouched. If any breaks, report it.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print dev
git add lib/repo/requests.repo.ts
git commit -m "feat(requests): soft-delete requests and bids, hide them from reads"
```

---

### Task 5: Filter relationships, point the services at the cascade

**Files:**
- Modify: `lib/repo/relationships.repo.ts`
- Modify: `lib/services/offers.service.ts`, `lib/services/requests.service.ts`
- Test: `__tests__/lib/services/offers.service.test.ts`, `__tests__/lib/services/requests.service.test.ts` (both exist — **append** a describe; do not overwrite; do not duplicate module-scope `jest.mock` calls)

**Interfaces:**
- Consumes: `softDeleteOfferCascade` / `softDeleteRequestCascade` from Tasks 3 and 4.
- Produces: `removeOffer` / `removeRequest` now tombstone descendants and throw 403 when unowned.

- [ ] **Step 1: Filter `relationshipExists`**

It runs two queries joining bids to their parents. Add `notDeleted(...)` for **both** the bid table and the parent table in each. A deleted listing must not establish a relationship that unlocks public-profile visibility.

- [ ] **Step 2: Write the failing tests**

Append to `__tests__/lib/services/offers.service.test.ts`:

```ts
describe("offersService.removeOffer soft delete", () => {
  beforeEach(() => jest.clearAllMocks());

  it("delegates to the cascading soft delete and never hard-deletes", async () => {
    (offersRepo.softDeleteOfferCascade as jest.Mock).mockResolvedValue(true);

    await offersService.removeOffer("offer-1", "owner-1");

    expect(offersRepo.softDeleteOfferCascade).toHaveBeenCalledWith(
      "offer-1",
      "owner-1",
    );
    expect(offersRepo.deleteOffer).not.toHaveBeenCalled();
  });

  it("throws when the caller does not own the offer", async () => {
    (offersRepo.softDeleteOfferCascade as jest.Mock).mockResolvedValue(false);

    await expect(
      offersService.removeOffer("offer-1", "someone-else"),
    ).rejects.toThrow("Only the owner can delete this");
  });
});
```

The `expect(deleteOffer).not.toHaveBeenCalled()` line is the load-bearing one — it fails if anyone reverts to the hard delete. Append the mirrored block for `removeRequest` to `__tests__/lib/services/requests.service.test.ts`, asserting against `requestsRepo.softDeleteRequestCascade` and `requestsRepo.deleteRequest`.

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm test -- __tests__/lib/services/`
Expected: FAIL — `softDeleteOfferCascade` is not yet called by the service.

- [ ] **Step 4: Point the services at the cascade**

```ts
export async function removeOffer(id: string, userId: string) {
  const removed = await offersRepo.softDeleteOfferCascade(id, userId);
  if (!removed) throw new AppError("Only the owner can delete this", 403);
}
```

Mirror for `removeRequest` with the identical message. `AppError` is already imported in both service files.

- [ ] **Step 5: Suite green**

Run: `pnpm test && pnpm lint`
Expected: 22 suites green with 4 new tests; lint 2 errors.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print dev
git add lib/repo/relationships.repo.ts lib/services/offers.service.ts lib/services/requests.service.ts __tests__/lib/services/
git commit -m "feat(delete): cascade the tombstone to bids and messages"
```

---

### Task 6: Lock the read rule with a source-level gate

**Files:**
- Create: `__tests__/lib/repo/soft-delete-coverage.test.ts`

**Interfaces:**
- Consumes: the filters from Tasks 2–5. This test must pass on arrival.

Tasks 2–5 added the predicate to 16 reads by hand. This test is what stops the 17th being added without it.

- [ ] **Step 1: Write the gate**

Create `__tests__/lib/repo/soft-delete-coverage.test.ts`:

```ts
import fs from "fs";
import path from "path";

/**
 * Guards the one rule that keeps soft-deleted content out of feeds and profiles:
 * every exported read in these modules filters on deleted_at.
 *
 * This is a source-level test on purpose. Calling each function and inspecting
 * generated SQL would need a live database or an elaborate mock, and would still
 * say nothing about a read added tomorrow. Deriving the list from the module's
 * own exports means the next read function is covered the moment it is written.
 */
const REPOS = [
  "messages.repo.ts",
  "offers.repo.ts",
  "requests.repo.ts",
  "relationships.repo.ts",
];

/** Reads are what must filter; writes carry their own scoping. */
const READ_PREFIXES = ["find", "get", "has", "relationship"];

function bodiesOf(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /^export async function (\w+)/gm;
  const marks: { name: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    marks.push({ name: m[1], start: m.index });
  }
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : src.length;
    out.set(mark.name, src.slice(mark.start, end));
  });
  return out;
}

describe("soft-delete read coverage", () => {
  for (const file of REPOS) {
    const src = fs.readFileSync(
      path.join(process.cwd(), "lib", "repo", file),
      "utf8",
    );
    const bodies = bodiesOf(src);
    const reads = [...bodies.keys()].filter((name) =>
      READ_PREFIXES.some((p) => name.toLowerCase().startsWith(p)),
    );

    it(`${file} exposes at least one read function`, () => {
      expect(reads.length).toBeGreaterThan(0);
    });

    for (const name of reads) {
      it(`${file}: ${name} filters soft-deleted rows`, () => {
        expect(bodies.get(name)).toContain("notDeleted(");
      });
    }
  }
});
```

- [ ] **Step 2: Run it — it must pass immediately**

Run: `pnpm test -- __tests__/lib/repo/soft-delete-coverage.test.ts`
Expected: PASS, with roughly 16 read cases plus 4 "exposes at least one" cases.

If a case FAILS, Tasks 2–5 missed that function — fix the repo, not the test. If the count of discovered reads looks wrong (far fewer than 16), the prefix heuristic is not matching; report that rather than loosening the assertion.

List every function the test discovered, per file, in your report. That list is the plan's real deliverable here.

- [ ] **Step 3: Prove the gate actually catches a regression**

Temporarily remove the `notDeleted(...)` predicate from `findOffers` in `lib/repo/offers.repo.ts`. Re-run the test and confirm the `offers.repo.ts: findOffers filters soft-deleted rows` case FAILS. Restore the predicate and confirm it passes again.

Report what you observed. A gate nobody has seen fail is not known to work.

- [ ] **Step 4: Full suite**

Run: `pnpm test && pnpm lint`
Expected: all green; lint 2 errors.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print dev
git add __tests__/lib/repo/soft-delete-coverage.test.ts
git commit -m "test(repo): gate requiring every repo read to filter soft-deleted rows"
```

---

### Task 7: Storage delete helper and the open-report query

**Files:**
- Create: `lib/supabase/storage.ts`
- Modify: `lib/repo/reports.repo.ts`
- Test: **Create** `__tests__/lib/supabase/storage.test.ts`

**Interfaces:**
- Produces: `objectPathFromUrl(url)`, `deleteStorageObject(url)`, and `reportsRepo.findOpenReportTargetIds(requestIds, offerIds)`. Task 8 consumes all three.

- [ ] **Step 1: Write the storage helper**

Uploads go client-side to the `post_photos` bucket, so `imgUrl` is a public URL and the object path must be recovered from it. Keep the parsing pure so it is testable without Supabase.

Create `lib/supabase/storage.ts`:

```ts
const BUCKET = "post_photos";

/**
 * Recover the storage object path from a stored public URL.
 *
 * Public URLs look like
 *   https://<ref>.supabase.co/storage/v1/object/public/post_photos/<path>
 * Returns null for anything that is not a URL into this bucket, so a
 * hand-edited or external value cannot make the caller delete the wrong object.
 */
export function objectPathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}
```

Then add `deleteStorageObject(url)` below it: parse the path, bail returning `false` if null, otherwise call `.storage.from(BUCKET).remove([path])` on the service-role client. **Open `lib/supabase/admin.ts` and use its actual export name and signature** — do not assume. Wrap the whole call in `try/catch` and return a boolean; it must never throw, because the sweep continues past a storage failure.

- [ ] **Step 2: Test the pure part**

Create `__tests__/lib/supabase/storage.test.ts`:

```ts
import { objectPathFromUrl } from "@/lib/supabase/storage";

const base = "https://abc.supabase.co/storage/v1/object/public";

describe("objectPathFromUrl", () => {
  it("extracts the path from a public bucket URL", () => {
    expect(objectPathFromUrl(`${base}/post_photos/user-1/pic.png`)).toBe(
      "user-1/pic.png",
    );
  });

  it("strips a query string", () => {
    expect(objectPathFromUrl(`${base}/post_photos/a/b.png?token=x`)).toBe(
      "a/b.png",
    );
  });

  it("decodes escaped characters", () => {
    expect(objectPathFromUrl(`${base}/post_photos/my%20pic.png`)).toBe(
      "my pic.png",
    );
  });

  it("returns null for a URL into a different bucket", () => {
    expect(objectPathFromUrl(`${base}/avatars/a.png`)).toBeNull();
  });

  it("returns null for an unrelated URL", () => {
    expect(objectPathFromUrl("https://example.com/a.png")).toBeNull();
  });

  it("returns null when there is no path after the bucket", () => {
    expect(objectPathFromUrl(`${base}/post_photos/`)).toBeNull();
  });
});
```

The different-bucket and unrelated-URL cases are the point: they are what stops the sweep deleting an avatar.

- [ ] **Step 3: Add the open-report query**

In `lib/repo/reports.repo.ts`, add a batched lookup — the sweep runs over every due row nightly, so this must not be per-listing:

```ts
/**
 * Which of these listings have an open report against them.
 *
 * The purge skips these so a reported user cannot delete the evidence and wait
 * out the retention window.
 */
export async function findOpenReportTargetIds(
  requestIds: string[],
  offerIds: string[],
): Promise<{ requestIds: Set<string>; offerIds: Set<string> }> {
  const result = { requestIds: new Set<string>(), offerIds: new Set<string>() };
  if (requestIds.length === 0 && offerIds.length === 0) return result;

  const targets = [
    requestIds.length > 0
      ? inArray(reports.reported_request_id, requestIds)
      : undefined,
    offerIds.length > 0
      ? inArray(reports.reported_offer_id, offerIds)
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      requestId: reports.reported_request_id,
      offerId: reports.reported_offer_id,
    })
    .from(reports)
    .where(and(eq(reports.status, "open"), or(...targets)));

  for (const r of rows) {
    if (r.requestId) result.requestIds.add(r.requestId);
    if (r.offerId) result.offerIds.add(r.offerId);
  }
  return result;
}
```

`or`, `and`, `eq`, `inArray` come from `drizzle-orm` — check which are already imported in this file. The explicit `.filter(Boolean)` avoids relying on `or()` tolerating `undefined`; if TypeScript objects to the resulting type, narrow it rather than reintroducing `undefined` into the call.

- [ ] **Step 4: Suite green**

Run: `pnpm test && pnpm lint`
Expected: green with 6 new tests; lint 2 errors.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print dev
git add lib/supabase/storage.ts lib/repo/reports.repo.ts __tests__/lib/supabase/storage.test.ts
git commit -m "feat(retention): storage object delete and open-report lookup"
```

---

### Task 8: The anonymize sweep

**Files:**
- Create: `lib/repo/purge.repo.ts`
- Modify: `app/api/cron/expire-bids/route.ts`
- Test: **Create** `__tests__/lib/repo/purge.test.ts`

**Interfaces:**
- Consumes: `retentionCutoff` (Task 1), `findOpenReportTargetIds` (Task 7), `deleteStorageObject` (Task 7).
- Produces: `purgeDueListings(now: Date)` returning a summary the cron logs, and `ANONYMIZED_TITLE`.

- [ ] **Step 1: Write the sweep**

Create `lib/repo/purge.repo.ts`. Shape it as: find due candidates → subtract reported ones → per listing, hard-delete messages then anonymize → return counts.

```ts
/** Placeholder for an anonymized listing. title is NOT NULL, so it cannot be nulled. */
export const ANONYMIZED_TITLE = "[deleted]";

export type PurgeSummary = {
  requests: number;
  offers: number;
  messagesDeleted: number;
  skippedReported: number;
  storageFailures: number;
};

export async function purgeDueListings(now: Date): Promise<PurgeSummary> {
  // 1. candidates: soft-deleted before the cutoff and not already anonymized
  // 2. reported = await reportsRepo.findOpenReportTargetIds(reqIds, offIds)
  // 3. for each remaining listing:
  //      - capture imgUrl BEFORE nulling it
  //      - hard-delete its messages (via its bids)
  //      - set title = ANONYMIZED_TITLE, description/incentive/imgUrl = null
  //      - deleteStorageObject(capturedUrl) — count failures, never throw
  //      - DO NOT touch its bids (spec D2 — reviews cascade from them)
  // 4. return the counts
}
```

Fill that in against the real schema. Hard requirements, all load-bearing:

- **Never delete a bid**, in any code path.
- `title` takes `ANONYMIZED_TITLE`; `description`, `incentive`, `imgUrl` become null. Leave `fee`, `price`, `urgency`, `status`, `user_id`, and both timestamps alone.
- Candidate predicate must include `ne(title, ANONYMIZED_TITLE)` so a second run is a no-op.
- Use `retentionCutoff(now)`, never a literal 30.
- A failed storage delete increments `storageFailures` and the sweep continues.

- [ ] **Step 2: Write the tests**

Create `__tests__/lib/repo/purge.test.ts`, mocking `@/lib/db`, `@/lib/repo/reports.repo`, and `@/lib/supabase/storage`. Cover:

1. a due listing is anonymized and its messages hard-deleted
2. a listing with an open report is skipped — assert **neither** the message delete **nor** the listing update ran for it
3. a listing soft-deleted *inside* the window is not touched
4. **bids are never deleted** — assert no delete is issued against `offer_bids` or `request_bids` in any path
5. a failing `deleteStorageObject` still lets the sweep finish and reports the failure count
6. a second run over an already-anonymized listing is a no-op

Case 4 is the most important test in this plan. It stands between a retention sweep and silently erasing every review attached to a deleted listing. Write it so it inspects the mocked db calls, not just the return value.

- [ ] **Step 3: Add the fourth cron step**

In `app/api/cron/expire-bids/route.ts`, after the broadcast-notification prune, call `purgeDueListings(new Date())` inside its own `try/catch` so a failure is logged and the route still returns 200 with the other counts — exactly how `prunedBroadcasts` is already handled. Add the summary to both the `console.log` and the JSON response.

Pass `new Date()` in from the route rather than calling it inside the sweep, so tests can pin time.

- [ ] **Step 4: Suite green**

Run: `pnpm test && pnpm lint`
Expected: green; lint 2 errors.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print dev
git add lib/repo/purge.repo.ts "app/api/cron/expire-bids/route.ts" __tests__/lib/repo/purge.test.ts
git commit -m "feat(retention): anonymize soft-deleted listings after 30 days"
```

---

### Task 9: Re-site Delete in the tracker

**Files:**
- Modify: `app/(protected)/tracker/page.tsx`

**No test** — no component harness exists and one must not be added. Verify statically. **Do not start a dev server.**

The close-model work repointed the owned-request card's button from delete to close, leaving `handleDeleteRequest` with no caller. Delete needs its own entry point, and its copy must be honest about what soft delete now does.

- [ ] **Step 1: Fix the confirmation copy**

`handleDeleteRequest`'s modal message becomes:

```
"Delete this request? It and its messages will be removed. Reviews you've given and received stay on both profiles."
```

Add an equivalent `handleDeleteOffer` calling `removeOffer`, with "offer" for "request". Both must surface the server error via `alert(error)` rather than a hardcoded string, matching the withdraw handlers.

- [ ] **Step 2: Give Delete an entry point on both owned cards**

The card exposes one `onDelete` slot, now used by Close. Do **not** overload it. Render Delete as a distinct secondary action on owned cards, matching the file's existing style — visually subordinate to Close and clearly destructive. Do not remove or relabel Close.

If the shared card component cannot take a second action without a props change, **report that and put Delete in the card's detail modal instead** — do not change the shared component's API in this task.

- [ ] **Step 3: Optimistically drop the card**

On success, filter the listing out of local state — it is hidden everywhere now, so leaving it on screen until refresh would be wrong. Reuse the existing `setRequests` / `setOffers` filter pattern.

- [ ] **Step 4: Verify statically**

Run: `pnpm lint && npx tsc --noEmit 2>&1 | grep -v "offers.test.ts\|requests.test.ts"` then `pnpm test`
Expected: lint 2 errors, no type errors, suite green.

In your report state: where Delete now appears for each card type, the exact confirmation copy, that Close is still present and unchanged, and — since you cannot open a browser — whether a second action can overflow the card's action row at mobile width.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print dev
git add "app/(protected)/tracker/page.tsx"
git commit -m "feat(tracker): re-site Delete alongside Close with honest copy"
```

---

## Final verification

- [ ] `pnpm test` — 22+ suites, all green
- [ ] `pnpm lint` — exactly 2 errors, 14 warnings
- [ ] `npx tsc --noEmit` — only the two pre-existing test-file errors
- [ ] `pnpm test -- __tests__/lib/repo/soft-delete-coverage.test.ts` — the gate passes
- [ ] `git push origin dev`
- [ ] **Niles runs `pnpm drizzle-kit push`** — the app cannot work against the live database until then

## Deliberately not in this plan

- **Account deletion** — `users.id` cascades from `auth.users`; a Supabase-level concern with its own policy language.
- **`deleteReview`** — a user removing their own review is legitimate and separate; reviews are not soft-deletable.
- **The moderation UI** that would read tombstones, and the narrow admin read functions that would serve it. Consequence worth stating: after this plan, soft-deleted rows are invisible to *everyone*, including staff. The observability that motivated soft delete is latent until that surface exists.
- `Ongoing` (requests) and `Busy` (offers) remain declared and unwritten.
