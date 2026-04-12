# Post Finishing System Design

**Date:** 2026-04-12
**Project:** MakeAbot
**Status:** Approved

---

## Overview

This spec covers the full lifecycle finishing system for offers and requests — how deals are marked done, how bidders are notified, and how completed items are surfaced in the tracker. It also includes a rename of the `posts` → `offers` domain to align the codebase with the UI.

Excludes: review system implementation (reserved via `url` field in notifications), security fixes.

---

## Scope

1. DB rename: `posts` → `offers`, `post_bids` → `offer_bids`
2. `bid_status` enum rework
3. New finishing actions: `completeRequest`, `completeOfferBid`, `closeOffer`
4. Remove `acceptDeal` (dead code)
5. Bidder withdraw UI + auto-expire cron
6. Tracker UI: Close replaces Delete for owned offers, History section
7. ChatListModal: per-bid "Mark done" buttons
8. Chat screen: "Mark done" in header, read-only banner on completion
9. Notifications: new completion event types, revised email strategy

---

## 1. Database & Schema

### Rename

```sql
ALTER TABLE posts RENAME TO offers;
ALTER TABLE post_bids RENAME TO offer_bids;
```

All FK references, indexes, and constraints updated accordingly. Drizzle schema constants and table definitions renamed to match.

### `bid_status` enum

Old: `Pending | Accepted | Closed`
New: `Pending | Completed | Closed`

- `Completed` — deal done (winning request bid, or fulfilled offer bid)
- `Closed` — rejected/superseded (losing request bids on completion, all pending bids on offer close, ghost-expired bids)

Migration:
```sql
-- offer_bids has no status column yet — no rows to update, column added fresh below
UPDATE request_bids SET status = 'Pending' WHERE status = 'Accepted';
-- then drop 'Accepted' from enum, add 'Completed'
```

### `offer_bids` — add status column

`offer_bids` currently has no status column.

```sql
ALTER TABLE offer_bids ADD COLUMN status bid_status NOT NULL DEFAULT 'Pending';
```

### No new tables.

---

## 2. Service & Action Layer

### Remove `acceptDeal`

Delete entirely from `lib/actions/deals.ts`. No accept step exists anywhere in the new flow.

### Remove `acceptRequestBid` / `rejectRequestBid`

Remove from `lib/services/requests.service.ts` and `lib/repo/requests.repo.ts`. The `updateRequestBidStatus` repo function stays (used by new finishing logic).

### New actions in `lib/actions/deals.ts`

**`completeRequest(requestId: string, winningBidId: string)`**
1. Auth check
2. Set winning bid → `Completed`
3. Set all other `Pending` bids on that request → `Closed`
4. Set request → `Completed`, stamp `completed_at`
5. Fire `request_completed_winner` notification to winning bidder
6. Fire `request_completed_loser` notification to all other closed bidders

**`completeOfferBid(bidId: string)`**
1. Auth check
2. Set bid → `Completed`
3. Offer status untouched — stays `Active`
4. Fire `offer_bid_completed` notification to bidder

**`closeOffer(offerId: string, userId: string)`**
1. Auth check
2. Set offer → `Closed`
3. Set all `Pending` bids on offer → `Closed`
4. No notification (owner-initiated)

### Simplify `getDealStatus`

Remove `bidStatus` from return type — callers only need `parentStatus`.

### File renames

| Old | New |
|---|---|
| `lib/actions/posts.ts` | `lib/actions/offers.ts` |
| `lib/services/posts.service.ts` | `lib/services/offers.service.ts` |
| `lib/repo/posts.repo.ts` | `lib/repo/offers.repo.ts` |
| `lib/validation/posts.ts` | `lib/validation/offers.ts` |

All import paths updated across codebase. `requests.*` files untouched.

### `offer_bids` status in `editPost` → `editOffer`

`editOffer` (renamed from `editPost`) in `offers.service.ts`: keep existing logic. `closeOffer` is now the canonical close path — callers should prefer it over raw `editOffer({ status: 'Closed' })`.

### Auto-expire service logic

New function `expireStaleOfferBids()` in `offers.service.ts`:
- Finds `Pending` offer_bids where parent offer `updated_at < now() - 14 days`
- Bulk-sets to `Closed`
- Returns `{ bidId, bidderId, offerTitle }[]` for notification dispatch

New function `expireStaleRequestBids()` in `requests.service.ts`:
- Same pattern for request_bids

---

## 3. UI Changes

### Tracker — owned offer cards

Replace Delete button with **Close** button (outlined, no destructive color — closing is a normal lifecycle action, not a destructive one).

- Close calls `closeOffer`. Confirm dialog: `"Close this offer? All open inquiries will be ended."`
- Edit stays as-is.

### Tracker — owned request cards

- Active requests: Edit + Close. Close calls `removeRequest` (request with no transaction is just deleted).
- Completed requests: no actions, card is read-only in History section.

### Tracker — non-owned cards (bids I placed)

Replace Close/Delete with **Withdraw** button.
- Offer bids: calls `removeOfferBid(bidId)`. Confirm: `"Withdraw your inquiry?"`
- Request bids: calls `removeRequestBid(bidId)`. Confirm: `"Withdraw your bid?"`
- Card removed from tracker state immediately on success.

### Tracker — History section

Pinned below the active cards grid. Collapsed by default.

- Toggle row: `▶ History (N)` — full-width, easy tap target, chevron rotates on expand
- Expanded: same card grid layout, cards dimmed (opacity reduced), no Edit/Close/Withdraw actions
- Respects active filter tab (Offers/Requests/All)
- Mobile: single-column grid, same as active section — no special breakpoint logic needed

**What appears in History:**
- Completed requests (owned)
- Offers with status `Closed` (owned)
- Offer bids with status `Completed` or `Closed` (non-owned)
- Request bids on completed/cancelled requests (non-owned)

### ChatListModal — finishing actions

**Request modal:** Each person row gains a "Mark done" button (small, outlined). Tapping calls `completeRequest(requestId, bidId)`. Modal closes. Card moves to History on next tracker load.

**Offer modal:** Each person row gains "Mark done". Tapping calls `completeOfferBid(bidId)`. Modal stays open. Completed person row disappears from list. Offer stays active.

### Chat screen — finishing

Small "Mark done" button in chat header (outlined, not filled — avoid accidental taps). Confirm dialog before firing.

- Offer chat: calls `completeOfferBid(bidId)`
- Request chat: calls `completeRequest(requestId, bidId)` — request owner only; inquirer sees button but it's hidden/disabled on their side

After completion: non-dismissable banner below header — `"This deal has been marked done."` Chat input disabled. Thread stays readable.

**Completed/closed request chats (all parties):** Banner — `"This request has been fulfilled."` Input disabled. Read-only.

---

## 4. Notifications

### New notification types

**`request_completed_winner`**
- Title: `"Your offer was accepted!"`
- Body: `"[Requester name] marked your bid on [request title] as done."`
- `url`: `/reviews/new?targetId=[requesterId]&context=[requestId]` *(reserved — review flow not yet built)*
- Delivery: push (immediate) + email (immediate) + in-app

**`request_completed_loser`**
- Title: `"Request fulfilled"`
- Body: `"[request title] has been fulfilled by someone else."`
- `url`: `/`
- Delivery: push (immediate) + in-app only (no email)

**`offer_bid_completed`**
- Title: `"Deal confirmed!"`
- Body: `"[Offerer name] marked your deal on [offer title] as done."`
- `url`: `/reviews/new?targetId=[offererId]&context=[offerId]` *(reserved)*
- Delivery: push (immediate) + email (immediate) + in-app

**`bid_expired`**
- Title: `"Inquiry closed"`
- Body: `"[offer/request title] has been inactive for 2 weeks. Your inquiry was automatically closed."`
- `url`: `/`
- Delivery: push (immediate) + in-app only (no email)

### Trigger points

| Event | Triggered in |
|---|---|
| `request_completed_winner` | `completeRequest()` service |
| `request_completed_loser` | `completeRequest()` service (× N losers) |
| `offer_bid_completed` | `completeOfferBid()` service |
| `bid_expired` | `expireStaleOfferBids()` / `expireStaleRequestBids()` service |

### Revised email strategy

| Event | Email |
|---|---|
| New inquiry on your post | ✅ immediate |
| Request completed (winner) | ✅ immediate |
| Offer bid completed | ✅ immediate |
| Daily digest (unread messages) | ✅ daily |
| Request completed (loser) | ❌ in-app + push only |
| New review received | ❌ in-app only |
| Bid expired | ❌ in-app + push only |
| Broadcast new post/request | ❌ push + in-app only |

---

## 5. Auto-Expire Cron

New endpoint: `app/api/cron/expire-bids/route.ts`

- Auth: `CRON_SECRET` Bearer token (same pattern as `daily-digest`)
- Logic:
  1. Call `expireStaleOfferBids()` — returns `{ bidId, bidderId, postTitle }[]`
  2. Call `expireStaleRequestBids()` — returns `{ bidId, bidderId, requestTitle }[]`
  3. For each affected bidder, fire `bid_expired` notification
- Schedule: daily (run after daily-digest, e.g. 8:05 AM UTC)
- Added to `vercel.json` crons

---

## 6. Files Affected

### New files
- `lib/actions/offers.ts` (renamed from posts.ts)
- `lib/services/offers.service.ts` (renamed)
- `lib/repo/offers.repo.ts` (renamed)
- `lib/validation/offers.ts` (renamed)
- `app/api/cron/expire-bids/route.ts`

### Modified files
- `lib/db/schema.ts` — rename tables, add `offer_bids.status`
- `lib/db/enums.ts` — update `bid_status` enum
- `lib/actions/deals.ts` — remove `acceptDeal`, rework `finishDeal` → `completeRequest` / `completeOfferBid` / `closeOffer`
- `lib/services/requests.service.ts` — remove `acceptRequestBid` / `rejectRequestBid`, add `expireStaleRequestBids`
- `lib/repo/requests.repo.ts` — remove accept/reject query
- `app/(protected)/tracker/page.tsx` — Close replaces Delete for offers, Withdraw for non-owned, History section
- `app/(protected)/chat/page.tsx` (or equivalent) — Mark done button, completion banners
- `components/ui/ChatListModal` (inline in tracker) — add Mark done per row
- `vercel.json` — add expire-bids cron schedule
- All files importing `posts.*` — update to `offers.*`

### Deleted files
- `lib/actions/posts.ts` (replaced by offers.ts)
- `lib/services/posts.service.ts` (replaced)
- `lib/repo/posts.repo.ts` (replaced)
- `lib/validation/posts.ts` (replaced)

---

## Out of Scope

- Review system implementation (URL field reserved, flow not built)
- Security fixes (tracked separately)
- Soft delete / archiving beyond the History section
- Symmetric bidder mark-done (bidder can only withdraw)
- Offer `Busy` status (dropped — no accept step means no natural trigger)
