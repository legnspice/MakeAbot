# Closing System Remediation — Design

> Captured 2026-08-15. Resolves the open questions left in
> `request-offer-lifecycle-rework-notes.md` (2026-04-08) and the defects found
> in the audit of the same date.

---

## Problem

The three closing transitions — `completeRequest`, `completeOfferBid`,
`closeOffer` — were built incrementally and never reviewed as one system. The
user-visible report is "slow and broken". The audit found that to be one
compound failure plus four independent defects.

### The compound failure

1. Marking a request done from the chat header costs 1 Supabase Auth call plus
   6 **serial** DB round-trips.
2. The chat button has no pending state — no disable, no spinner.
3. So the user perceives a freeze and clicks again.
4. `completeRequest` is not idempotent, and completion notifications pass
   `contextId: null`, which takes the plain-`insertNotification` branch in
   `push.service.ts` rather than the coalescing upsert.
5. Every extra click inserts a fresh duplicate bell row for the winner **and
   every loser**, and re-sends their pushes.

### Independent defects

- **No authorization on any status transition.** `completeOfferBid`,
  `withdrawOfferBid`, `reopenOfferBid`, `withdrawRequestBid` authenticate the
  caller and then act on an arbitrary id. `completeRequest` scopes its UPDATE to
  `req.user_id` — the row owner's id, never compared to the caller. Any logged-in
  user can complete or withdraw any stranger's deal. `removeOffer`/`editOffer`/
  `closeOffer` do it correctly, so the pattern exists; it was skipped on the
  transition actions. No test exercises a non-owner caller.
- **Withdrawn bidders are notified as losers.** The loser set is computed as
  `status === "Closed"` *after* the bulk close, which also matches bids the
  bidder withdrew earlier. They receive "Request fulfilled" for a request they
  walked away from.
- **`updated_at` is never written on `offers` or `requests`.** No `$onUpdate` in
  the schema and no service writes it, yet `expireStaleOfferBids` /
  `expireStaleRequestBids` measure staleness as
  `parent.updated_at < now() - 14 days`. The 14-day clock therefore runs from
  **creation**. Edits and new bids never reset it, so live bids on any listing
  older than two weeks are silently auto-Closed with a `bid_expired` notification
  nobody triggered.
- **Losing bidders are treated as completed deals.** `isDone` for
  `kind === "request"` keys off `parentStatus`, not the bid's own status. On
  completion every losing bidder's chat is disabled *and* the review modal opens
  for a deal they lost. This is the unanswered Open Question #3 from the 2026-04-08
  notes shipping its accidental default.

### Non-defects (verified, deliberately unchanged)

- `completeOfferBid` not touching the parent offer's status is correct — offers
  are standing listings that survive individual completed bids.
- The feed already filters `status: "Active"`, so completed requests and closed
  offers drop out correctly.
- `getTrackerData` is properly batched; the tracker N+1 recorded in earlier notes
  is fixed.

---

## Decisions

**D1 — Losing bidders' chats close, but only the winner is prompted to review.**
Answers Open Question #3. Read-only is correct: the request is fulfilled and out
of the feed, so leaving threads live invites messages nobody will act on. But a
review is a record of a *transaction*, and a losing bidder had none. Chat
read-only continues to key off `parentStatus`; review eligibility becomes a
separate signal keyed off `bidStatus === "Completed"`. The losers' banner changes
to name what actually happened.

**D2 — Closing an offer keeps its image.** The `imgUrl: null` write in both
`closeOffer` and `editOffer` is removed. It destroys the only pointer to the
photo while leaving the storage object orphaned in the bucket — strictly worse
than either keeping it or deleting both. Closed offers keep their photo in
tracker history.

**D3 — Ownership is enforced in the layer that already holds the data.**
`completeOfferBid` gets its check in the action, which already fetches the bid
and offer — zero extra round-trips, and the existing action-test mocks cover it.
`completeRequest` gets a `callerId` parameter checked in the service, because the
action does not fetch the request and adding a fetch would fight the latency work.
`withdraw`/`reopen` get scoped in the repo `WHERE` clause, which is both the check
and the write in one query.

**D4 — Staleness means "no activity", not "created long ago".** Two parts, kept
separable: `$onUpdate` on `offers.updated_at` / `requests.updated_at` so edits bump
the clock, and an explicit parent touch when a new bid arrives. `$onUpdate` is a
drizzle runtime default and emits no DDL, so no migration is required.

**D5 — Idempotency is enforced by state, and errors say what happened.**
Re-completing throws `AppError` with a human message, which `handleAction`
surfaces verbatim (generic `Error` collapses to "Something went wrong"). The loser
set is derived from the rows the bulk close actually transitioned, via
`.returning()`, which makes correct loser targeting and idempotency the same fix.

---

## Out of scope

- `Busy` (offer) and `Cancelled` (request) are declared in `lib/db/enums.ts` and
  written nowhere. Requests still have no "close without a winner" path — a
  requester with zero bids can only delete. Both are real gaps; both are product
  design, not defect repair.
- `requireAuth()` costing a network round-trip per action. Real, and the largest
  single latency lever left, but it is app-wide and belongs to the Epic F pass.
- Storage bucket cleanup for genuinely deleted offers (task #19).
