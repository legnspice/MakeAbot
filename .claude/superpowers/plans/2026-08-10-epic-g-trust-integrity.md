# Epic G — Trust Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate reviews to completed deals (one per deal), gate/coalesce reports without silent drops, and add a minimal admin view so reports are actionable.

**Architecture:** Schema adds `users.is_admin`, `reports.updated_at`/`report_count`, and partial-unique indexes on `reviews`. Review + report creation rules move into their services (session identity from `requireAuth`); pure helpers (`oneBidRef`, `mergeReportDetails`, `isValidReportStatus`) are unit-tested. A `requireAdmin()` guard fronts admin-only actions and an `/admin/reports` page.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Zod, Jest.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). No new branch.
- One `drizzle-kit push` (this epic's schema) is run by the user in their TTY — this plan does NOT run it. Code must compile without it. **Backfill hazard:** pre-existing duplicate `(creator_id, offer_bid_id)` / `(creator_id, request_bid_id)` review rows will block the partial-unique-index creation — dedupe via SQL before the push.
- Layered backend: Server Action → Service → Repository → DB. Actions call `requireAuth()`; identity (`creator_id`/`reporter_id`) always injected from the session, never client input.
- Report statuses: `open | reviewing | resolved | dismissed` (default `open`).
- Admins identified by `users.is_admin` (set manually via SQL for the beta). Every admin action AND the admin page load must independently enforce `is_admin`.
- Deliberately OUT: rate-limiting, analytics, auto-moderation, report notifications.
- Only touched files must be lint-clean; `npm format` before push.

---

### Task 1: Schema — `is_admin`, report coalesce columns, review unique indexes

**Files:**
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces: `users.is_admin` (boolean), `reports.updated_at` (timestamp), `reports.report_count` (integer) on `SelectUser`/`SelectReport`; two partial-unique indexes on `reviews`.

- [ ] **Step 1: Add `is_admin` to users**

In the `users` table, after `avatar_url`:

```ts
  is_admin: boolean("is_admin").notNull().default(false),
```

- [ ] **Step 2: Add coalesce columns to reports**

In the `reports` table, after `status`:

```ts
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  report_count: integer("report_count").notNull().default(1),
```

- [ ] **Step 3: Add partial-unique indexes to reviews**

The `reviews` table currently has no third `pgTable` argument. Add one (mirrors the `notifications` coalesce-index pattern already in this file). `uniqueIndex` and `sql` are already imported:

```ts
export const reviews = pgTable(
  "reviews",
  {
    // ...existing columns unchanged...
  },
  (t) => [
    uniqueIndex("reviews_creator_offer_bid_idx")
      .on(t.creator_id, t.offer_bid_id)
      .where(sql`${t.offer_bid_id} IS NOT NULL`),
    uniqueIndex("reviews_creator_request_bid_idx")
      .on(t.creator_id, t.request_bid_id)
      .where(sql`${t.request_bid_id} IS NOT NULL`),
  ],
);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(schema): users.is_admin, reports coalesce cols, reviews partial-unique indexes"
```

---

### Task 2: Pure trust helpers (TDD)

**Files:**
- Create: `lib/reviews.ts`
- Modify: `lib/reports.ts`
- Test: `__tests__/lib/reviews.test.ts`
- Modify: `__tests__/lib/reports.test.ts`

**Interfaces:**
- Produces:
  - `oneBidRef(d: { offer_bid_id?: string | null; request_bid_id?: string | null }): { kind: "offer" | "request"; bidId: string } | null` — the single bid reference, or `null` if zero or both are set (`lib/reviews.ts`).
  - `mergeReportDetails(existing: string | null, incoming: string | null | undefined): string | null` — appends with a `"\n---\n"` separator, skipping empties (`lib/reports.ts`).
  - `isValidReportStatus(s: string): boolean` — `s ∈ {open, reviewing, resolved, dismissed}` (`lib/reports.ts`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/reviews.test.ts`:

```ts
import { oneBidRef } from "@/lib/reviews";

describe("oneBidRef", () => {
  it("returns the offer ref when only offer_bid_id is set", () => {
    expect(oneBidRef({ offer_bid_id: "o1", request_bid_id: null })).toEqual({
      kind: "offer",
      bidId: "o1",
    });
  });
  it("returns the request ref when only request_bid_id is set", () => {
    expect(oneBidRef({ request_bid_id: "r1" })).toEqual({
      kind: "request",
      bidId: "r1",
    });
  });
  it("returns null when neither is set", () => {
    expect(oneBidRef({})).toBeNull();
  });
  it("returns null when both are set", () => {
    expect(oneBidRef({ offer_bid_id: "o1", request_bid_id: "r1" })).toBeNull();
  });
});
```

Append to `__tests__/lib/reports.test.ts`:

```ts
import { mergeReportDetails, isValidReportStatus } from "@/lib/reports";

describe("mergeReportDetails", () => {
  it("joins existing and incoming with a separator", () => {
    expect(mergeReportDetails("a", "b")).toBe("a\n---\nb");
  });
  it("returns the non-empty side when the other is empty", () => {
    expect(mergeReportDetails("a", null)).toBe("a");
    expect(mergeReportDetails(null, "b")).toBe("b");
    expect(mergeReportDetails("a", "")).toBe("a");
  });
  it("returns null when both are empty", () => {
    expect(mergeReportDetails(null, null)).toBeNull();
    expect(mergeReportDetails("", undefined)).toBeNull();
  });
});

describe("isValidReportStatus", () => {
  it("accepts the four statuses", () => {
    for (const s of ["open", "reviewing", "resolved", "dismissed"]) {
      expect(isValidReportStatus(s)).toBe(true);
    }
  });
  it("rejects anything else", () => {
    expect(isValidReportStatus("deleted")).toBe(false);
    expect(isValidReportStatus("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/lib/reviews.test.ts __tests__/lib/reports.test.ts`
Expected: FAIL — `oneBidRef`/`mergeReportDetails`/`isValidReportStatus` not found.

- [ ] **Step 3: Implement**

Create `lib/reviews.ts`:

```ts
export function oneBidRef(d: {
  offer_bid_id?: string | null;
  request_bid_id?: string | null;
}): { kind: "offer" | "request"; bidId: string } | null {
  const hasOffer = !!d.offer_bid_id;
  const hasRequest = !!d.request_bid_id;
  if (hasOffer === hasRequest) return null; // zero or both → invalid
  return hasOffer
    ? { kind: "offer", bidId: d.offer_bid_id as string }
    : { kind: "request", bidId: d.request_bid_id as string };
}
```

Append to `lib/reports.ts`:

```ts
export function mergeReportDetails(
  existing: string | null,
  incoming: string | null | undefined,
): string | null {
  const a = existing?.trim() || "";
  const b = incoming?.trim() || "";
  if (a && b) return `${a}\n---\n${b}`;
  return a || b || null;
}

export function isValidReportStatus(s: string): boolean {
  return ["open", "reviewing", "resolved", "dismissed"].includes(s);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/reviews.test.ts __tests__/lib/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews.ts lib/reports.ts __tests__/lib/reviews.test.ts __tests__/lib/reports.test.ts
git commit -m "feat(trust): pure helpers oneBidRef, mergeReportDetails, isValidReportStatus (tested)"
```

---

### Task 3: Review completed-deal gate + dedupe

**Files:**
- Modify: `lib/repo/reviews.repo.ts`
- Modify: `lib/services/reviews.service.ts`

**Interfaces:**
- Consumes: `oneBidRef` (Task 2); existing `findOfferBidById`/`findOfferById` (`offers.repo`), `findRequestBidById`/`findRequestById` (`requests.repo`); `AppError`; `InsertReviewSchema`.
- Produces: `findReviewByCreatorAndBid(creatorId, kind, bidId)` (repo); a hardened `reviewsService.createReview` that gates on a completed deal and rejects duplicates.

- [ ] **Step 1: Add the dedupe query to the repo**

In `lib/repo/reviews.repo.ts`, add:

```ts
export async function findReviewByCreatorAndBid(
  creatorId: string,
  kind: "offer" | "request",
  bidId: string,
) {
  const col = kind === "offer" ? reviews.offer_bid_id : reviews.request_bid_id;
  return await db.query.reviews.findFirst({
    where: and(eq(reviews.creator_id, creatorId), eq(col, bidId)),
  });
}
```

(`and`/`eq` and `reviews` are already imported in this file.)

- [ ] **Step 2: Harden the service**

In `lib/services/reviews.service.ts`, add imports and gate logic. Add:

```ts
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import { oneBidRef } from "../reviews";
import { AppError } from "../error/app-error";
```

Replace `createReview` with:

```ts
export async function createReview(data: InsertReviewSchema) {
  if (data.creator_id === data.rated_user_id) {
    throw new AppError("You can't review yourself.", 400);
  }

  const ref = oneBidRef(data);
  if (!ref) {
    throw new AppError("A review must reference exactly one deal.", 400);
  }

  // Verify the referenced bid is a COMPLETED deal linking the reviewer and the rated user.
  let bidderId: string | undefined;
  let ownerId: string | null | undefined;
  let status: string | undefined;
  if (ref.kind === "offer") {
    const bid = await offersRepo.findOfferBidById(ref.bidId);
    if (bid) {
      bidderId = bid.bidder_id;
      status = bid.status;
      const offer = await offersRepo.findOfferById(bid.offer_id);
      ownerId = offer?.user_id;
    }
  } else {
    const bid = await requestsRepo.findRequestBidById(ref.bidId);
    if (bid) {
      bidderId = bid.bidder_id;
      status = bid.status;
      const req = await requestsRepo.findRequestById(bid.request_id);
      ownerId = req?.user_id;
    }
  }

  const parties = new Set([bidderId, ownerId]);
  const linksBoth =
    parties.has(data.creator_id) && parties.has(data.rated_user_id);
  if (status !== "Completed" || !linksBoth) {
    throw new AppError(
      "You can only review a completed deal you were part of.",
      403,
    );
  }

  // One review per reviewer per deal.
  const existing = await reviewsRepo.findReviewByCreatorAndBid(
    data.creator_id,
    ref.kind,
    ref.bidId,
  );
  if (existing) {
    throw new AppError("You've already reviewed this deal.", 409);
  }

  return await reviewsRepo.insertReview(data);
}
```

(The `createReview` action in `lib/actions/reviews.ts` already injects `creator_id: user.id` and calls this service — no action change needed.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/repo/reviews.repo.ts lib/services/reviews.service.ts
git commit -m "feat(reviews): gate to completed deal + one review per deal"
```

---

### Task 4: Report user-gate, own-post guard, coalesce-with-feedback

**Files:**
- Modify: `lib/repo/reports.repo.ts`
- Modify: `lib/services/reports.service.ts`
- Modify: `lib/actions/reports.ts`

**Interfaces:**
- Consumes: `relationshipExists` (`relationships.repo`), `findOfferById`/`findRequestById`, `mergeReportDetails` + `isSelfReport` (`lib/reports`), `AppError`, `InsertReportSchema`.
- Produces: repo `findOpenReportByTarget` + `coalesceReport`; a `reportsService.createReport(data & { reporter_id })` that gates, guards own-post, and coalesces, returning `{ coalesced: boolean }`.

- [ ] **Step 1: Repo — open-report lookup + coalesce update**

In `lib/repo/reports.repo.ts`, add (`db`, `reports`, `and`, `eq`, `sql` — import what's missing):

```ts
import { and, eq, sql } from "drizzle-orm";

type Target = {
  reported_user_id?: string;
  reported_offer_id?: string;
  reported_request_id?: string;
};

function targetCondition(t: Target) {
  if (t.reported_user_id) return eq(reports.reported_user_id, t.reported_user_id);
  if (t.reported_offer_id) return eq(reports.reported_offer_id, t.reported_offer_id);
  return eq(reports.reported_request_id, t.reported_request_id!);
}

export async function findOpenReportByTarget(reporterId: string, t: Target) {
  return await db.query.reports.findFirst({
    where: and(
      eq(reports.reporter_id, reporterId),
      eq(reports.status, "open"),
      targetCondition(t),
    ),
  });
}

export async function coalesceReport(id: string, mergedDetails: string | null) {
  return await db
    .update(reports)
    .set({
      details: mergedDetails,
      updated_at: sql`now()`,
      report_count: sql`${reports.report_count} + 1`,
    })
    .where(eq(reports.id, id));
}
```

- [ ] **Step 2: Service — gates + coalesce**

Rewrite `lib/services/reports.service.ts`:

```ts
import * as reportsRepo from "../repo/reports.repo";
import * as relationshipsRepo from "../repo/relationships.repo";
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import { mergeReportDetails, isSelfReport } from "../reports";
import { AppError } from "../error/app-error";
import type { InsertReportSchema } from "../validation/reports";

export async function createReport(
  data: InsertReportSchema & { reporter_id: string },
): Promise<{ coalesced: boolean }> {
  // Self-report guards.
  if (isSelfReport(data.reporter_id, data.reported_user_id)) {
    throw new AppError("You can't report yourself.", 400);
  }
  if (data.reported_offer_id) {
    const offer = await offersRepo.findOfferById(data.reported_offer_id);
    if (offer?.user_id === data.reporter_id) {
      throw new AppError("You can't report your own post.", 400);
    }
  }
  if (data.reported_request_id) {
    const req = await requestsRepo.findRequestById(data.reported_request_id);
    if (req?.user_id === data.reporter_id) {
      throw new AppError("You can't report your own post.", 400);
    }
  }

  // User reports require a prior interaction; post reports stay open.
  if (data.reported_user_id) {
    const related = await relationshipsRepo.relationshipExists(
      data.reporter_id,
      data.reported_user_id,
    );
    if (!related) {
      throw new AppError(
        "You can only report someone you've interacted with.",
        403,
      );
    }
  }

  const target = {
    reported_user_id: data.reported_user_id,
    reported_offer_id: data.reported_offer_id,
    reported_request_id: data.reported_request_id,
  };
  const open = await reportsRepo.findOpenReportByTarget(data.reporter_id, target);
  if (open) {
    const merged = mergeReportDetails(open.details, data.details);
    await reportsRepo.coalesceReport(open.id, merged);
    return { coalesced: true };
  }

  await reportsRepo.insertReport(data);
  return { coalesced: false };
}
```

- [ ] **Step 3: Slim the action (guards now live in the service)**

Rewrite `lib/actions/reports.ts`:

```ts
"use server";

import * as reportsService from "@/lib/services/reports.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { insertReportSchema } from "@/lib/validation/reports";

export async function createReport(input: unknown) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const data = insertReportSchema.parse(input);
    return reportsService.createReport({ ...data, reporter_id: user.id });
  });
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/reports.repo.ts lib/services/reports.service.ts lib/actions/reports.ts
git commit -m "feat(reports): user-gate, own-post guard, coalesce-with-feedback"
```

---

### Task 5: ReportModal — coalesced feedback

**Files:**
- Modify: `components/report-modal.tsx`

**Interfaces:**
- Consumes: `createReport` now returns `{ data?: { coalesced: boolean }; error?: string }`.

- [ ] **Step 1: Branch the success message on `coalesced`**

In `components/report-modal.tsx`, add a `coalesced` state (`const [coalesced, setCoalesced] = useState(false);`), reset it in `reset()`, and after a successful submit set it from the result:

```ts
    const result = await createReport(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCoalesced(Boolean(result.data?.coalesced));
    setDone(true);
```

In the success branch, use the coalesced copy:

```tsx
            <p className="text-sm text-gray-600 mb-5">
              {coalesced
                ? "You've already reported this — we've added your note. Our team is reviewing it."
                : "Thanks for helping keep MakeAbot safe. Our team will review this."}
            </p>
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/report-modal.tsx
git commit -m "feat(reports): coalesced-repeat feedback in ReportModal"
```

---

### Task 6: Admin backend — `requireAdmin`, `getReports`, `updateReportStatus`

**Files:**
- Modify: `lib/repo/reports.repo.ts`
- Create: `lib/actions/admin.ts`
- Modify: `lib/actions/auth.ts`

**Interfaces:**
- Consumes: `requireAuth`; `usersRepo.findUsers`; `getUsers`/`getOffers`/`getRequests` (batched via repos); `isValidReportStatus` (Task 2); `AppError`.
- Produces:
  - `requireAdmin(): Promise<{ id: string }>` — throws `AppError("Forbidden", 403)` for non-admins (`lib/actions/auth.ts`).
  - repo `findReports({ status? })` (open first, then `updated_at` desc) + `updateReportStatus(id, status)`.
  - actions `getReports({ status? })` returning hydrated rows `{ report, reporterName, targetLabel }[]`, and `updateReportStatus(id, status)` — both admin-guarded.

- [ ] **Step 1: `requireAdmin` guard**

In `lib/actions/auth.ts`, add (import `usersRepo` from `@/lib/repo/users.repo` and `AppError` from `@/lib/error/app-error`):

```ts
import * as usersRepo from "@/lib/repo/users.repo";
import { AppError } from "@/lib/error/app-error";

export async function requireAdmin() {
  const user = await requireAuth();
  const rows = await usersRepo.findUsers({ id: user.id });
  if (!rows[0]?.is_admin) throw new AppError("Forbidden", 403);
  return user;
}
```

- [ ] **Step 2: Repo — list + status update**

In `lib/repo/reports.repo.ts`, add (`desc`, `asc` from drizzle-orm):

```ts
export async function findReports(filters: { status?: string }) {
  return await db.query.reports.findMany({
    where: filters.status ? eq(reports.status, filters.status) : undefined,
    orderBy: [
      sql`case when ${reports.status} = 'open' then 0 else 1 end`,
      desc(reports.updated_at),
    ],
  });
}

export async function updateReportStatus(id: string, status: string) {
  return await db
    .update(reports)
    .set({ status, updated_at: sql`now()` })
    .where(eq(reports.id, id));
}
```

- [ ] **Step 3: Admin actions with hydration**

Create `lib/actions/admin.ts`:

```ts
"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAdmin } from "@/lib/actions/auth";
import { AppError } from "@/lib/error/app-error";
import { isValidReportStatus } from "@/lib/reports";
import * as reportsRepo from "@/lib/repo/reports.repo";
import * as usersRepo from "@/lib/repo/users.repo";
import * as offersRepo from "@/lib/repo/offers.repo";
import * as requestsRepo from "@/lib/repo/requests.repo";
import type { SelectReport } from "@/lib/db/schema";

export type AdminReportRow = {
  report: SelectReport;
  reporterName: string;
  targetLabel: string;
};

export async function getReports(filters: { status?: string } = {}) {
  return await handleAction<AdminReportRow[]>(async () => {
    await requireAdmin();
    const rows = await reportsRepo.findReports(filters);

    const userIds = new Set<string>();
    const offerIds = new Set<string>();
    const requestIds = new Set<string>();
    for (const r of rows) {
      userIds.add(r.reporter_id);
      if (r.reported_user_id) userIds.add(r.reported_user_id);
      if (r.reported_offer_id) offerIds.add(r.reported_offer_id);
      if (r.reported_request_id) requestIds.add(r.reported_request_id);
    }

    const users = userIds.size
      ? await usersRepo.findUsers({ ids: Array.from(userIds) })
      : [];
    const userName = new Map(users.map((u) => [u.id, u.name ?? "User"]));
    const offers = await Promise.all(
      Array.from(offerIds).map((id) => offersRepo.findOfferById(id)),
    );
    const offerTitle = new Map(
      offers.filter(Boolean).map((o) => [o!.id, o!.title]),
    );
    const requests = await Promise.all(
      Array.from(requestIds).map((id) => requestsRepo.findRequestById(id)),
    );
    const requestTitle = new Map(
      requests.filter(Boolean).map((r) => [r!.id, r!.title]),
    );

    return rows.map((report) => {
      let targetLabel = "—";
      if (report.reported_user_id)
        targetLabel = `User: ${userName.get(report.reported_user_id) ?? "User"}`;
      else if (report.reported_offer_id)
        targetLabel = `Offer: ${offerTitle.get(report.reported_offer_id) ?? "(deleted)"}`;
      else if (report.reported_request_id)
        targetLabel = `Request: ${requestTitle.get(report.reported_request_id) ?? "(deleted)"}`;
      return {
        report,
        reporterName: userName.get(report.reporter_id) ?? "User",
        targetLabel,
      };
    });
  });
}

export async function updateReportStatus(id: string, status: string) {
  return await handleAction(async () => {
    await requireAdmin();
    if (!isValidReportStatus(status)) {
      throw new AppError("Invalid status.", 400);
    }
    await reportsRepo.updateReportStatus(id, status);
    return { success: true };
  });
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/reports.repo.ts lib/actions/admin.ts lib/actions/auth.ts
git commit -m "feat(admin): requireAdmin + getReports (hydrated) + updateReportStatus"
```

---

### Task 7: Admin page + admin-only nav entry

**Files:**
- Create: `app/(protected)/admin/reports/page.tsx`
- Modify: `app/(protected)/profile/page.tsx`

**Interfaces:**
- Consumes: `getReports`/`updateReportStatus`/`AdminReportRow` (Task 6); `useAuth().userData.publicUser.is_admin` (available after Task 1's column).

- [ ] **Step 1: Admin reports page**

Create `app/(protected)/admin/reports/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { useAuth } from "@/contexts/auth-context";
import {
  getReports,
  updateReportStatus,
  type AdminReportRow,
} from "@/lib/actions/admin";

const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default function AdminReportsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const isAdmin = userData.publicUser.is_admin;
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    getReports().then((res) => {
      setRows(res.data ?? []);
      setLoading(false);
    });
  }, [isAdmin, router]);

  async function handleStatus(id: string, status: string) {
    setRows((prev) =>
      prev.map((r) => (r.report.id === id ? { ...r, report: { ...r.report, status } } : r)),
    );
    await updateReportStatus(id, status);
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-3xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-4">Reports</h1>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400">No reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ report, reporterName, targetLabel }) => (
              <li
                key={report.id}
                className="rounded-xl border border-gray-200 p-4 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {targetLabel}
                  </span>
                  {report.report_count > 1 && (
                    <span className="text-xs text-gray-500">
                      ×{report.report_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {report.reason} · by {reporterName}
                </p>
                {report.details && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {report.details}
                  </p>
                )}
                <select
                  value={report.status}
                  onChange={(e) => handleStatus(report.id, e.target.value)}
                  className="mt-2 self-start rounded-lg border border-gray-300 text-sm px-2 py-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Admin-only nav entry on the profile page**

In `app/(protected)/profile/page.tsx`, add a link to `/admin/reports` shown only for admins. Add the import `import Link from "next/link";` if not present, read the flag near the top of the component:

```tsx
  const isAdmin = userData.publicUser.is_admin;
```

and render, inside the desktop buttons row and the mobile column (near the logout button), gated:

```tsx
        {isAdmin && (
          <Link
            href="/admin/reports"
            className="text-sm text-[#3761B0] hover:underline"
          >
            Admin · Reports
          </Link>
        )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(protected)/admin/reports/page.tsx" "app/(protected)/profile/page.tsx"
git commit -m "feat(admin): /admin/reports page + admin-only nav entry"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the new/changed unit tests**

Run: `npm test -- __tests__/lib/reviews.test.ts __tests__/lib/reports.test.ts`
Expected: all pass.

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint lib/db/schema.ts lib/reviews.ts lib/reports.ts lib/repo/reviews.repo.ts lib/services/reviews.service.ts lib/repo/reports.repo.ts lib/services/reports.service.ts lib/actions/reports.ts lib/actions/admin.ts lib/actions/auth.ts components/report-modal.tsx "app/(protected)/admin/reports/page.tsx" "app/(protected)/profile/page.tsx"
```
Expected: 0 errors from these files.

- [ ] **Step 3: Manual QA (after the bundled `drizzle-kit push`)**

- [ ] Review: from a chat where the deal is marked done, leaving a review works; a second review of the same deal is blocked ("already reviewed"); a review whose bid isn't Completed, or where you weren't a party, is rejected.
- [ ] Report user: reporting someone you've never bid with/for is blocked; reporting a counterparty works.
- [ ] Report post: reporting someone else's post works; reporting your OWN post is blocked.
- [ ] Coalesce: reporting the same target twice increments `report_count`, appends details, and the modal shows the "already reported — added your note" message.
- [ ] Admin: a non-admin hitting `/admin/reports` is redirected to `/` AND `getReports`/`updateReportStatus` reject them if called directly; an admin sees reports open-first with target labels + reporter + count, and can change status. The "Admin · Reports" link shows only for admins.

---

## Notes / dependencies

- **Bundled push:** `users.is_admin`, `reports.updated_at`, `reports.report_count`, and the two `reviews` partial-unique indexes are applied in one `drizzle-kit push` in the user's TTY. **Dedupe existing duplicate `(creator, bid)` reviews first** or the index creation fails. Set admin(s) via `update users set is_admin = true where id = '...';`.
- Admins authorized by `is_admin` enforced in BOTH `requireAdmin` (actions) and the page's redirect — never nav-hiding alone.
