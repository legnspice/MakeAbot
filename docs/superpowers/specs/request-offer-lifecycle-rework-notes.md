# Request / Offer Lifecycle Rework — Context Notes

> Captured during notifications brainstorm on 2026-04-08. Start a new brainstorm session with this file as context.

---

## Core Problem

The current accept→complete flow creates friction and risk:
- Requesters must explicitly accept a bid before completing a request — extra step
- If an accepted lender ghosts or backs out, the requester is stuck
- Bid rejection notifications fire when a request is completed (all losing bids get "Closed"), misleading the bidder

---

## Proposed Changes

### 1. Remove explicit bid acceptance for Requests

**Current flow:** Request posted → bids come in → owner accepts one → request marked complete
**Proposed flow:** Request posted → bids come in → owner just marks the request as Complete when done

- No more "Accept bid" action — owner just talks to whoever they want and marks done when finished
- All bids remain open/visible until the request is closed
- Protects requester: no risk of an "accepted" lender ghosting mid-transaction
- Less friction: one action (complete) instead of two (accept → complete)

**Implications:**
- `acceptRequestBid` function removed
- `bid_accepted` / `bid_rejected` notification types retired (no more false rejection spam)
- `request_bids.status` simplified — no "Accepted" state, only Open / Closed (closed when request completes)
- Tracker UI: no accept button, just a complete button on the request card

### 2. Complete button per Bid for Offers (Posts)

- Each bid on an offer/post gets its own "Mark complete" button
- Completing a bid closes that specific bid, not the whole offer
- Offer stays open for new bids after one bid is completed (ongoing offer)

**Implications:**
- `post_bids.status` gets a "Completed" state distinct from "Closed" (rejected)
- `posts.service.ts` needs a `completePostBid(bidId)` function

### 3. Bid list ordering for Offers

- Newest/active bids listed at the top
- Completed bids hidden in a collapsible "Completed" section at the bottom
- Prevents clutter as an offer accumulates completed transactions over time

**Affected files (preliminary):**
- `lib/services/requests.service.ts` — remove `acceptRequestBid`, update `createRequest` completion logic
- `lib/services/posts.service.ts` — add `completePostBid`
- `lib/repo/requests.repo.ts` — remove accept query
- `lib/repo/posts.repo.ts` — add complete-bid query
- `lib/db/schema.ts` / migrations — simplify `request_bids` status enum, add "Completed" to `post_bids` status
- Tracker UI components — remove accept button, add complete button, reorder bid lists
- `lib/validation/notifications.ts` — retire `bid_accepted` / `bid_rejected` types

---

## Open Questions (for the full brainstorm)

1. Should completing a request notify the winning bidder (the one the requester actually transacted with)? If so, how does the system know which bidder "won" without an explicit accept step?
2. Should there be a review prompt triggered on request/bid completion?
3. What happens to in-progress chats when a request is completed — do they stay open?
4. Is there a status between "open" and "complete" for requests (e.g., "In progress")?
