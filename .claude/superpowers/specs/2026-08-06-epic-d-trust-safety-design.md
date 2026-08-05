# Epic D — Trust & Safety (Reporting + Help) — Design Spec

**Date:** 2026-08-06
**Epic:** D (trust/safety/legal)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Give users a way to report bad actors and bad posts (persisted for a future admin review), and a static `/help` page covering how-to + safety/reporting guidance.

Source: QA backlog Epic D + ARSA admin's "bad actors / rating weaponization" concern. Scope confirmed 2026-08-06.

## Scope (decided)

**In:** an incident-`reports` table, a shared report modal wired to a few entry points, and a `/help` page.

**Out (deliberately):**
- **No email** on report (declined — DB persistence only for now).
- **No admin view** — a simple admin dashboard for triaging reports is a separate, later scope. Reports accumulate in the table until then.
- **Legal pages (ToU / Privacy)** — deferred; the drafts were lost and will be redone later. Not in this epic.

## Design

### 1. `reports` table + `report_reason` enum
`lib/db/enums.ts` — add:
```
REPORT_REASON_VALUES = ["Spam", "Harassment or bullying", "Scam or fraud", "Inappropriate content", "Other"]
report_reason pgEnum + ReportReasonEnum (zod) + ReportReason type
```
`lib/db/schema.ts` — add:
```
reports:
  id                 uuid pk defaultRandom
  reporter_id        uuid -> users(id) notNull
  reported_user_id   uuid -> users(id)       (nullable)
  reported_offer_id  uuid -> offers(id)      (nullable, onDelete set null or cascade)
  reported_request_id uuid -> requests(id)   (nullable)
  reason             report_reason notNull
  details            text                    (nullable)
  status             text notNull default 'open'   // open | reviewing | resolved | dismissed (admin uses later; text keeps it simple now)
  created_at         timestamp notNull default now
export type SelectReport = typeof reports.$inferSelect;
```
Requires a `drizzle-kit push` (new enum + table) — bundle with Epic E's `new_review` column drop.

### 2. Validation + backend (layered)
- `lib/validation/reports.ts`: `insertReportSchema` — `reason` (ReportReasonEnum), `details` (string max ~500, nullable/optional), and the target ids (all uuid optional). **Refine:** at least one of `reported_user_id`/`reported_offer_id`/`reported_request_id` must be present. `reporter_id` is NOT in the client schema — the action injects it from the session.
- `lib/repo/reports.repo.ts`: `insertReport(data)`.
- `lib/services/reports.service.ts`: `createReport(data)` passthrough.
- `lib/actions/reports.ts`: `createReport(data)` — `requireAuth()`, inject `reporter_id = user.id`, guard against self-report (`reported_user_id === user.id` → reject), insert. Returns `{ success: true }`. (Dedupe/rate-limit noted as future, not now.)

### 3. Shared report modal + entry points
`components/report-modal.tsx` — `ReportModal({ open, onClose, target })` where `target` is `{ type: "user" | "offer" | "request"; id: string; label?: string }`. Renders: a reason picker (the 5 enum values), an optional details textarea (maxlength), Submit/Cancel; on submit calls `createReport` with the right target id, shows a success state ("Report submitted — thanks for helping keep MakeAbot safe"), and closes. Client-side guard + server guard for self-report.

Entry points (all reuse the one modal):
- **Public profile** `app/(protected)/profile/[userId]/page.tsx` — a "Report user" action (e.g. a small overflow/"⋯" or a subtle text button in the header). Never shown on your own profile (route already redirects self).
- **Item-detail modal** `components/ui/item-detail-modal.tsx` — a "Report post" affordance; target `{ type: offer|request, id: posterId's post }`. Not shown when `isOwner`.
- **Chat header** `app/(protected)/chat/page.tsx` — a "Report user" option targeting `otherId` (bad-actor interactions surface in chat). Optional but low-cost; include if it fits cleanly.

### 4. `/help` page
`app/(protected)/help/page.tsx` (client or server; static content) — sections: What is MakeAbot / How to post an offer or request / How bidding & chat work / Incentives (the ₱-cap rule) / Staying safe (meet in public campus spots, don't share sensitive info) / Reporting (how + that reports are reviewed) / Contact. Linked from a sensible place (e.g. profile page or nav/settings). Copy drafted in the plan; plain, Ateneo-student tone.

## Testing
- **Unit (pure, TDD):** the report-target validation predicate — "at least one target id present" passes with any one id, fails with none; self-report guard (`reported_user_id === reporter_id`) rejects. Extract as a pure helper so it's testable without a DB.
- **Manual QA:** submit a report from each entry point → a row lands in `reports` with the right target + reason + `reporter_id` + `status='open'`; self-report is blocked (own profile has no button, and the server rejects a forged self-report); `/help` renders and is reachable; all at mobile + widescreen.

## Risks & verification
- **Schema push:** verify the `reports` table + `report_reason` enum apply; existing tables untouched.
- **Target integrity:** exactly the intended target id is set; nullable FKs don't break inserts; deleting a reported post/user shouldn't error (choose `onDelete` behavior — `set null` keeps the report; `cascade` removes it — spec picks **set null** so reports survive for audit).
- **Self-report / spoofing:** the action derives `reporter_id` from `requireAuth()` and rejects self-reports server-side; the client never supplies `reporter_id`.
- **Privacy:** a report is not shown back to the reported user; no notification is sent to anyone.

## Non-goals
- No admin dashboard, no report email, no auto-moderation, no legal pages (all later).
