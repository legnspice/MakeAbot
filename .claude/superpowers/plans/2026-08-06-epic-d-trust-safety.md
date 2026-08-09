# Epic D — Trust & Safety (Reporting + Tutorial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users report bad actors/posts into a persisted `reports` table, and fold safety + reporting guidance into the existing tutorial modal (no `/help` page).

**Architecture:** A `reports` table + `report_reason` enum, a layered `createReport` server action (viewer injected from `requireAuth`, self-report rejected server-side), a shared `ReportModal` component, and page-owned wiring from three entry points (item-detail modal via an `onReport` callback, public profile, chat header). Two new steps in `TutorialModal` cover staying-safe + reporting.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Zod, Jest, shadcn Dialog, react-bootstrap-icons.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). Do NOT create a new branch.
- One combined `drizzle-kit push` (adds the `reports` table + `report_reason` enum here; also drops Epic E's `new_review` column) is run by the user in their TTY — this plan does NOT run it. Code must compile without it having run.
- Layered backend: Server Action → Service → Repository → DB. Actions wrap in `handleAction()`, call `requireAuth()`, and inject `reporter_id` from the session — the client never supplies it.
- Report reasons (exact, ordered): `["Spam", "Harassment or bullying", "Scam or fraud", "Inappropriate content", "Other"]`.
- `reported_*` FKs use `onDelete: "set null"` so reports survive deletion of the target; `reporter_id` uses `onDelete: "cascade"`.
- Self-report is rejected server-side and never offered in the UI (own profile already redirects; item modal hidden when `isOwner`).
- No email, no admin view, no legal pages (all later).
- Only touched files must be lint-clean; `npm format` before push.
- Brand colors: request/action blue `#3761B0`, amber `#DEA440`.

---

### Task 1: `report_reason` enum + `reports` table

**Files:**
- Modify: `lib/db/enums.ts`
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces: `REPORT_REASON_VALUES`, `reportReasonEnum` (pgEnum), `ReportReasonEnum` (zod), `ReportReason` (type) from enums; `reports` table + `SelectReport`/`InsertReport` types from schema.

- [ ] **Step 1: Add the enum**

In `lib/db/enums.ts`, append:

```ts
// Report reason
export const REPORT_REASON_VALUES = [
  "Spam",
  "Harassment or bullying",
  "Scam or fraud",
  "Inappropriate content",
  "Other",
] as const;
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASON_VALUES);
export const ReportReasonEnum = z.enum(REPORT_REASON_VALUES);
export type ReportReason = z.infer<typeof ReportReasonEnum>;
```

- [ ] **Step 2: Add the table**

In `lib/db/schema.ts`: add `reportReasonEnum` to the existing enums import (the `from "./enums"` block near the top), then add the table after the last `pgTable` definition (before the `export type` block):

```ts
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporter_id: uuid("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reported_user_id: uuid("reported_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reported_offer_id: uuid("reported_offer_id").references(() => offers.id, {
    onDelete: "set null",
  }),
  reported_request_id: uuid("reported_request_id").references(
    () => requests.id,
    { onDelete: "set null" },
  ),
  reason: reportReasonEnum("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});
```

Add to the `export type` block at the bottom:

```ts
export type SelectReport = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (Does not require the push; this is type-level.)

- [ ] **Step 4: Commit**

```bash
git add lib/db/enums.ts lib/db/schema.ts
git commit -m "feat(schema): reports table + report_reason enum"
```

---

### Task 2: Report validation + pure guards (TDD)

**Files:**
- Create: `lib/reports.ts`
- Create: `lib/validation/reports.ts`
- Test: `__tests__/lib/reports.test.ts`

**Interfaces:**
- Consumes: `ReportReasonEnum` (Task 1).
- Produces:
  - `hasReportTarget(t: { reported_user_id?: string; reported_offer_id?: string; reported_request_id?: string }): boolean`
  - `isSelfReport(reporterId: string, reportedUserId?: string | null): boolean`
  - `insertReportSchema` (Zod) + `InsertReportSchema` type — `{ reason: ReportReason; details?: string | null; reported_user_id?: string; reported_offer_id?: string; reported_request_id?: string }`, refined to require at least one target.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/reports.test.ts`:

```ts
import { hasReportTarget, isSelfReport } from "@/lib/reports";
import { insertReportSchema } from "@/lib/validation/reports";

describe("hasReportTarget", () => {
  it("true when any one target id is present", () => {
    expect(hasReportTarget({ reported_user_id: "u1" })).toBe(true);
    expect(hasReportTarget({ reported_offer_id: "o1" })).toBe(true);
    expect(hasReportTarget({ reported_request_id: "r1" })).toBe(true);
  });
  it("false when no target is present", () => {
    expect(hasReportTarget({})).toBe(false);
  });
});

describe("isSelfReport", () => {
  it("true only when reporter equals reported user", () => {
    expect(isSelfReport("u1", "u1")).toBe(true);
    expect(isSelfReport("u1", "u2")).toBe(false);
    expect(isSelfReport("u1", undefined)).toBe(false);
    expect(isSelfReport("u1", null)).toBe(false);
  });
});

describe("insertReportSchema", () => {
  it("accepts a valid user report", () => {
    const r = insertReportSchema.safeParse({
      reason: "Spam",
      reported_user_id: "b3f1c2d4-0000-4000-8000-000000000001",
    });
    expect(r.success).toBe(true);
  });
  it("rejects when no target is present", () => {
    const r = insertReportSchema.safeParse({ reason: "Spam" });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid reason", () => {
    const r = insertReportSchema.safeParse({
      reason: "Nonsense",
      reported_user_id: "b3f1c2d4-0000-4000-8000-000000000001",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/reports.test.ts`
Expected: FAIL — cannot find modules `@/lib/reports` / `@/lib/validation/reports`.

- [ ] **Step 3: Write the pure guards**

Create `lib/reports.ts`:

```ts
export function hasReportTarget(t: {
  reported_user_id?: string;
  reported_offer_id?: string;
  reported_request_id?: string;
}): boolean {
  return Boolean(
    t.reported_user_id || t.reported_offer_id || t.reported_request_id,
  );
}

export function isSelfReport(
  reporterId: string,
  reportedUserId?: string | null,
): boolean {
  return !!reportedUserId && reporterId === reportedUserId;
}
```

- [ ] **Step 4: Write the validation schema**

Create `lib/validation/reports.ts`:

```ts
import { z } from "zod";
import { ReportReasonEnum } from "@/lib/db/enums";
import { hasReportTarget } from "@/lib/reports";

export const insertReportSchema = z
  .object({
    reason: ReportReasonEnum,
    details: z.string().max(500).nullish(),
    reported_user_id: z.string().uuid().optional(),
    reported_offer_id: z.string().uuid().optional(),
    reported_request_id: z.string().uuid().optional(),
  })
  .refine(hasReportTarget, {
    message: "A report must target a user, offer, or request.",
  });

export type InsertReportSchema = z.infer<typeof insertReportSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/lib/reports.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add lib/reports.ts lib/validation/reports.ts __tests__/lib/reports.test.ts
git commit -m "feat(reports): validation schema + pure target/self-report guards (tested)"
```

---

### Task 3: Report repo + service + action

**Files:**
- Create: `lib/repo/reports.repo.ts`
- Create: `lib/services/reports.service.ts`
- Create: `lib/actions/reports.ts`

**Interfaces:**
- Consumes: `reports` table + `InsertReport` (Task 1); `insertReportSchema` + `InsertReportSchema` (Task 2); `isSelfReport` (Task 2); existing `handleAction`, `requireAuth`, `AppError`.
- Produces: server action `createReport(input: unknown): Promise<{ data?: ...; error?: string }>` — parses `input` with `insertReportSchema`, rejects self-report, injects `reporter_id` from the session, inserts.

- [ ] **Step 1: Repo**

Create `lib/repo/reports.repo.ts`:

```ts
import { db } from "../db";
import { reports, type InsertReport } from "../db/schema";

export async function insertReport(data: InsertReport) {
  return await db.insert(reports).values(data).returning();
}
```

- [ ] **Step 2: Service**

Create `lib/services/reports.service.ts`:

```ts
import * as reportsRepo from "../repo/reports.repo";
import type { InsertReportSchema } from "../validation/reports";

export async function createReport(
  data: InsertReportSchema & { reporter_id: string },
) {
  return await reportsRepo.insertReport(data);
}
```

- [ ] **Step 3: Action**

Create `lib/actions/reports.ts`:

```ts
"use server";

import * as reportsService from "@/lib/services/reports.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import { insertReportSchema } from "@/lib/validation/reports";
import { isSelfReport } from "@/lib/reports";
import { AppError } from "@/lib/error/app-error";

export async function createReport(input: unknown) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const data = insertReportSchema.parse(input);
    if (isSelfReport(user.id, data.reported_user_id)) {
      throw new AppError("You can't report yourself.", 400);
    }
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
git commit -m "feat(reports): createReport action (session-injected reporter, self-report guarded)"
```

---

### Task 4: `ReportModal` component

**Files:**
- Create: `components/report-modal.tsx`

**Interfaces:**
- Consumes: `createReport` (Task 3); `REPORT_REASON_VALUES` + `ReportReason` (Task 1); shadcn `Dialog` primitives.
- Produces: `ReportModal({ open, onClose, target })` where `target: { type: "user" | "offer" | "request"; id: string; label?: string }`. Maps `target.type` → the matching `reported_*` id, submits, shows a success state, then closes.

- [ ] **Step 1: Create the component**

Create `components/report-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { REPORT_REASON_VALUES, type ReportReason } from "@/lib/db/enums";
import { createReport } from "@/lib/actions/reports";

export type ReportTarget = {
  type: "user" | "offer" | "request";
  id: string;
  label?: string;
};

export default function ReportModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget | null;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setReason("");
    setDetails("");
    setSubmitting(false);
    setDone(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!target || !reason) return;
    setSubmitting(true);
    setError(null);
    const input = {
      reason,
      details: details.trim() || null,
      ...(target.type === "user" ? { reported_user_id: target.id } : {}),
      ...(target.type === "offer" ? { reported_offer_id: target.id } : {}),
      ...(target.type === "request" ? { reported_request_id: target.id } : {}),
    };
    const result = await createReport(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  const noun =
    target?.type === "user" ? "user" : target?.type === "offer" ? "offer" : "request";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        {done ? (
          <div className="text-center py-4">
            <DialogTitle className="text-lg font-bold text-gray-900 mb-2">
              Report submitted
            </DialogTitle>
            <p className="text-sm text-gray-600 mb-5">
              Thanks for helping keep MakeAbot safe. Our team will review this.
            </p>
            <Button onClick={handleClose} className="min-w-[120px]">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Report {noun}
                {target?.label ? `: ${target.label}` : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <label className="text-sm font-medium text-gray-700">Reason</label>
              <div className="flex flex-col gap-2">
                {REPORT_REASON_VALUES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                      reason === r
                        ? "border-[#3761B0] bg-blue-50 text-[#3761B0] font-medium"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <label className="text-sm font-medium text-gray-700 mt-2">
                Details <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Add anything that helps us understand the issue."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0]"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="bg-[#3761B0] hover:bg-[#2d5199] text-white"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (Confirm `@/components/ui/dialog` exports `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` — it does; `tutorial-modal.tsx` imports the same set.)

- [ ] **Step 3: Commit**

```bash
git add components/report-modal.tsx
git commit -m "feat(reports): shared ReportModal (reason picker + details + success state)"
```

---

### Task 5: Wire report entry points (item-detail modal, profile, chat)

**Files:**
- Modify: `components/ui/item-detail-modal.tsx`
- Modify: `app/(protected)/(home)/page.tsx`
- Modify: `app/(protected)/profile/[userId]/page.tsx`
- Modify: `app/(protected)/chat/page.tsx`

**Interfaces:**
- Consumes: `ReportModal` + `ReportTarget` (Task 4). Pages own the `ReportModal` state; `ItemDetailModal` stays presentational via an `onReport?` callback.

- [ ] **Step 1: Add an `onReport` affordance to `ItemDetailModal`**

In `components/ui/item-detail-modal.tsx`: add `onReport?: () => void;` to `ItemDetailModalProps`, destructure it, and render a subtle "Report" text button in the content area (only when `onReport` is set and `!isOwner`). Add it right after the `lentBy`/`requestedBy` lines (near line 127), before `location`:

```tsx
            {onReport && !isOwner && (
              <button
                type="button"
                onClick={onReport}
                className="mt-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Report this post
              </button>
            )}
```

- [ ] **Step 2: Wire the feed page**

In `app/(protected)/(home)/page.tsx`:
- Add imports:
  ```tsx
  import ReportModal, { type ReportTarget } from "@/components/report-modal";
  ```
- Add state near the other `useState`s:
  ```tsx
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  ```
- Pass `onReport` to the `ItemDetailModal` (the JSX near line 316), building the target from the selected item:
  ```tsx
          onReport={
            selectedItem
              ? () =>
                  setReportTarget({
                    type: selectedItem.variant === "lent" ? "offer" : "request",
                    id: selectedItem.itemDbId,
                    label: selectedItem.detail.title,
                  })
              : undefined
          }
  ```
- Render the modal once, after `<ItemDetailModal ... />`:
  ```tsx
        <ReportModal
          open={reportTarget !== null}
          onClose={() => setReportTarget(null)}
          target={reportTarget}
        />
  ```

- [ ] **Step 3: Wire the public profile page ("Report user")**

In `app/(protected)/profile/[userId]/page.tsx`:
- Add imports:
  ```tsx
  import ReportModal, { type ReportTarget } from "@/components/report-modal";
  ```
- Add state:
  ```tsx
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  ```
- Add a "Report user" button in the header column, right after the contributions `<p>` (near line 133):
  ```tsx
            <button
              type="button"
              onClick={() =>
                setReportTarget({ type: "user", id: profile.id, label: name })
              }
              className="mt-3 ml-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Report user
            </button>
  ```
- Render the modal before the closing `</div>` of the page root (after `<BottomNav />` is fine, but keep it inside the top-level fragment/div):
  ```tsx
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
  ```
  (This page only renders for other users — self redirects to `/profile` — so the button never targets yourself.)

- [ ] **Step 4: Wire the chat header ("Report")**

In `app/(protected)/chat/page.tsx`:
- Add imports:
  ```tsx
  import ReportModal, { type ReportTarget } from "@/components/report-modal";
  ```
- Add state (inside `ChatPageInner`):
  ```tsx
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  ```
- Add a small "Report" button in the header, right after the "Mark done" button block (near line 146), so it sits at the right end of the header:
  ```tsx
        <button
          type="button"
          onClick={() =>
            setReportTarget({ type: "user", id: otherId, label: otherName || "user" })
          }
          className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Report
        </button>
  ```
- Render the modal before the final closing `</div>` of the returned JSX:
  ```tsx
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
  ```
  (`useState` is already imported in this file.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/ui/item-detail-modal.tsx "app/(protected)/(home)/page.tsx" "app/(protected)/profile/[userId]/page.tsx" "app/(protected)/chat/page.tsx"
git commit -m "feat(reports): report entry points on item detail, profile, and chat"
```

---

### Task 6: Safety + reporting steps in the tutorial modal

**Files:**
- Modify: `components/tutorial-modal.tsx`

**Interfaces:**
- Consumes: the existing `STEPS` array + `react-bootstrap-icons`. Progress dots map over `STEPS`, so adding entries needs no other change.

- [ ] **Step 1: Import two icons**

In `components/tutorial-modal.tsx`, add `ShieldFillCheck` and `FlagFill` to the existing `react-bootstrap-icons` import.

- [ ] **Step 2: Insert two steps before the final "Contact Us!" step**

In the `STEPS` array, insert these two objects immediately before the existing `{ icon: EnvelopeExclamationFill, ... title: "Contact Us!", ... }` entry:

```tsx
  {
    icon: ShieldFillCheck,
    iconBg: "bg-blue-100",
    iconColor: "text-[#3761B0]",
    title: "Stay Safe",
    body: "Meet in public spots around campus, keep deals inside MakeAbot, and never share sensitive personal or financial details.",
  },
  {
    icon: FlagFill,
    iconBg: "bg-amber-100",
    iconColor: "text-[#DEA440]",
    title: "Reporting",
    body: "If someone acts in bad faith or a post looks off, tap Report on their profile or the item. Reports go to our team for review.",
  },
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (The progress-dots `STEPS.map(...)` and step navigation already scale with array length; no other change needed.)

- [ ] **Step 4: Commit**

```bash
git add components/tutorial-modal.tsx
git commit -m "feat(tutorial): add Stay Safe + Reporting steps"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the new unit tests**

Run: `npm test -- __tests__/lib/reports.test.ts`
Expected: PASS (all cases).

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint lib/db/enums.ts lib/db/schema.ts lib/reports.ts lib/validation/reports.ts lib/repo/reports.repo.ts lib/services/reports.service.ts lib/actions/reports.ts components/report-modal.tsx components/ui/item-detail-modal.tsx components/tutorial-modal.tsx "app/(protected)/(home)/page.tsx" "app/(protected)/profile/[userId]/page.tsx" "app/(protected)/chat/page.tsx"
```
Expected: 0 errors from these files.

- [ ] **Step 3: Manual QA (after the combined `drizzle-kit push`)**

- [ ] Report a **post** from an item-detail modal (a non-owned item) → a `reports` row with `reported_offer_id` or `reported_request_id`, correct `reason`, `reporter_id` = you, `status='open'`.
- [ ] Report a **user** from a public profile and from a chat header → a row with `reported_user_id` set.
- [ ] Own item modal shows no "Report this post"; your own profile (redirects to `/profile`) offers no report.
- [ ] A forged self-report (`reported_user_id` = your id) is rejected by the action ("You can't report yourself.").
- [ ] The report modal: reason required to submit, details optional (≤500), success state shows then closes.
- [ ] Navbar "Help" → tutorial modal shows the new **Stay Safe** + **Reporting** steps with correct progress dots; at mobile + widescreen.

---

## Notes / dependencies

- **Combined push:** the `reports` table + `report_reason` enum are applied with Epic E's `new_review` column drop in one `drizzle-kit push` in the user's TTY. Code compiles/lints without it; report submission errors at runtime only until the table exists.
- No admin view, no email, no legal pages (all deliberately deferred).
