# Epic G — Trust Integrity (Reviews + Reports gating, Admin view) — Design Spec

**Date:** 2026-08-10
**Epic:** G (trust & safety integrity)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Close the abuse holes in the review and report systems and give reports a consumer:
1. **Reviews** can only be left for a **completed deal** between the two users, one per deal (kills rating weaponization — the ARSA concern).
2. **Reports** of a **user** require a prior interaction; **post** reports stay open; repeat reports **coalesce with feedback** (never silently dropped); self-reports rejected.
3. A **minimal admin view** so reports are actionable instead of write-only.

## Context & rationale (why this scope)

MakeAbot is a small, familiarity-based campus community (dorm cold-start), MVP/beta with ARSA, no auto-moderation. The product thesis is *reputation as a trustworthy signal*. Judged against that:
- **Reviews are the higher-severity system** — ratings are visible and affect reputation with no admin in the loop, so a completed-deal gate both stops weaponization *and* makes the score mean "real transactions." Highest ROI.
- **Reports currently have no consumer** (no admin view), so report-abuse harm is ~zero today; we build only the **cheap, correct** guards (reuse `relationshipExists`, honest coalesce, self-report guard) and **explicitly cut** rate-limiting/analytics until an admin can act. The **minimal admin view** is what actually gives reports teeth, so it's in-scope.
- The user-report relationship gate is belt-and-suspenders (reporters aren't anonymous, which self-deters in a small community) but it's near-free via the existing `relationshipExists` primitive, and consistent with the accountability model.

## Schema changes (one `drizzle-kit push`)

- `users.is_admin`: `boolean("is_admin").notNull().default(false)`. Admins are set manually via the Supabase SQL editor for the beta (ARSA + owner). No UI to toggle.
- `reports.updated_at`: `timestamp("updated_at").notNull().defaultNow()` (for coalescing + admin ordering).
- `reports.report_count`: `integer("report_count").notNull().default(1)` (bumped on coalesced repeats).
- `reviews`: two **partial unique indexes** — `uniqueIndex(...).on(creator_id, offer_bid_id).where(offer_bid_id IS NOT NULL)` and the same for `request_bid_id`. This makes "one review per reviewer per completed deal (bid)" a DB invariant. (Backfill note: if duplicate (creator, bid) review rows already exist, the index creation will fail — dedupe them first via SQL. Verify before the push.)

## Design

### 1. Review completed-deal gate + dedupe
Reviews are created via `RatingModal` (from chat, after "Mark done"), carrying `offer_bid_id`/`request_bid_id`; `createReview` already injects `creator_id` from the session (the modal's placeholder id is ignored). Harden the action:
- **Gate:** the review must reference exactly one bid (`offer_bid_id` XOR `request_bid_id`); that bid must be `status = "Completed"` and must link the session user and `rated_user_id` as `{bidder, owner}` (either role). Backed by a repo check `completedDealLinks(bidId, kind, a, b): boolean` (fetch the bid + parent, assert Completed + the two ids are the bidder and the parent's `user_id`). Reject otherwise with `AppError("You can only review a completed deal you were part of.", 403)`.
- **Dedupe:** before insert, check for an existing review by `(creator_id, that bid)`; if present, reject with `AppError("You've already reviewed this deal.", 409)` (friendly). The partial unique index is the hard backstop.
- No self-review (a user is never both bidder and owner of the same bid, so the gate already precludes it; assert `creator_id !== rated_user_id` defensively).

### 2. Report user-gate + coalesce-with-feedback + self-report guard
Extend `createReport` (built in Epic D):
- **User-gate:** when `reported_user_id` is set, require `relationshipExists(user.id, reported_user_id)` (reuse the C3b repo). Reject with `AppError("You can only report someone you've interacted with.", 403)` otherwise. **Post reports (`reported_offer_id`/`reported_request_id`) stay open** — no gate.
- **Self-report guard (extend):** already rejects self *user* reports; also reject reporting your **own post** (look up the offer/request owner = session user → reject). Keeps the queue clean.
- **Coalesce-with-feedback:** define the "same target" key as the present `reported_*` id. On submit, if an **open** report by the same `(reporter_id, target)` exists, **update** it instead of inserting: append the new `details` (with a separator), set `updated_at = now`, `report_count = report_count + 1`; return `{ coalesced: true }`. Else insert (`report_count = 1`) and return `{ coalesced: false }`. A resolved/dismissed report does **not** block a fresh one (recurring problems re-open a new row).
- **Modal feedback:** `ReportModal` shows *"Report submitted."* on first, *"You've already reported this — we've added your note. Our team is reviewing it."* when `coalesced`.

### 3. Minimal admin view
- **Auth:** `requireAdmin()` (`lib/actions/auth.ts` or a new `lib/actions/admin.ts`) = `requireAuth()` → load the user row → assert `is_admin`, else `AppError("Forbidden", 403)`. Every admin action + the page's data load goes through it.
- **Actions** (`lib/actions/reports.ts` or `admin.ts`): `getReports({ status? })` — admin-only, returns reports **newest `updated_at` first, open first**, each hydrated with reporter name + a resolved target label (user name / offer or request title) via batched lookups (no N+1); `updateReportStatus(id, status)` — admin-only, sets `status` ∈ `open|reviewing|resolved|dismissed`.
- **Status validation:** pure `isValidReportStatus(s): boolean` (unit-tested); the action rejects invalid values.
- **Page** `app/(protected)/admin/reports/page.tsx` — server-guarded (redirect non-admins to `/`); lists reports with target, reason, details, reporter, `report_count`, created/updated, and a status control (open→reviewing→resolved/dismissed). Read + status-change only. Responsive; plain admin styling.
- **Entry point:** a "Reports" link in the profile/nav shown **only when `is_admin`** (via `useAuth().userData.publicUser.is_admin`, available once the column exists).

## Out of scope (deliberate)
- Rate-limiting, report analytics/severity scoring, auto-moderation.
- Report notifications/emails; notifying a reported user.
- Any admin capability beyond viewing reports + changing their status (no ban/delete/message from the admin view yet).

## Testing
- **Unit (pure, TDD):** `isValidReportStatus` (accepts the 4, rejects others); a pure `mergeReportDetails(existing, incoming)` helper for coalescing (separator, handles empty/undefined either side) so the append logic is tested without a DB.
- **Manual QA (after the push):**
  - Review: leaving a review works only from a completed deal you were in; a second review of the same deal is blocked ("already reviewed"); a forged review of a non-counterparty / non-completed bid is rejected server-side.
  - Report: reporting a user you've never dealt with is blocked; reporting a post you didn't post works; reporting your own post is blocked; a repeat report coalesces (report_count increments, details appended) and the modal shows the "already reported" message.
  - Admin: a non-admin visiting `/admin/reports` is redirected; an admin sees reports open-first with resolved target labels and can change status; the "Reports" nav link shows only for admins.

## Risks & verification
- **Unique-index backfill:** pre-existing duplicate `(creator, bid)` reviews will block the partial-unique-index push — check and dedupe first.
- **Gate correctness:** verify the completed-deal check accepts the legitimate counterparty in both roles (bidder-reviews-owner and owner-reviews-bidder) and rejects strangers/incomplete deals.
- **Coalesce key:** ensure coalescing matches on the correct single target id and only among `open` rows; a resolved report must not absorb a new one.
- **Admin authorization:** confirm every admin action AND the page load independently enforce `is_admin` (never trust the client/nav-hiding alone); a non-admin hitting the action directly is rejected.
- **No privacy leak:** the admin view is the only place reporter identity is shown; it never surfaces to reported users.
