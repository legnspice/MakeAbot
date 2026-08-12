# Epic F — Tracker & Chat Performance — Design Spec

**Date:** 2026-08-05
**Epic:** F (performance)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Eliminate the tracker's N+1 fan-out and the chat's redundant/serial fetches — the dominant causes of the app's reported slowness — without touching the app-wide auth path.

Source: placeholder item #14 ("app noticeably slow") + the full data-layer sweep on 2026-08-05 (see `memory/project_perf_findings.md`).

## Scope (decided)

**In:** tracker load (server-side aggregation) + chat load (parallelize + dedupe). Plus reusable `inArray` batch variants on the offers/requests/bids repos.

**Out (deliberately):**
- The `requireAuth()` amplifier (every action calls `supabase.auth.getUser()` = a network round-trip). Biggest single lever, but it touches auth on every mutation — its own later pass. Server-side aggregation still *reduces* how often it runs (one auth check for the whole tracker instead of ~21).
- Home feed — already correctly batched (2 lists + one `getPublicUsers`). Do not touch.
- Pagination / virtualization for users with many deals — a separate payload/scan concern, orthogonal to this round-trip fix. Noted as future.
- Lazy/deferred per-card loading — rejected: the tracker's primary content (counterparty name + unread badge on every card face) is exactly the expensive part, so deferring it optimizes the wrong axis.

## Key facts (verified in code)

- `app/(protected)/tracker/page.tsx` `fetchTrackerData` (lines ~88-155): 4 initial parallel queries, then fans out **one `getOffers`/`getRequests` per placed bid** (lines 112-128) and **one `getOfferBids`/`getRequestBids` per owned post** (lines 98-110), then one batched `getUsers({ids})` for names. ~21 server actions ≈ 42 network round-trips for a 4-offers/4-requests/4+4-bids user (each action = 1 auth round-trip + 1 query).
- Repos have **no batch-by-ids support**: `findOffers`/`findRequests` filter by scalar `id` (`eq`); `findOfferBids`/`findRequestBids` by scalar `offer_id`/`request_id` (`eq`). `users.repo.findUsers`/`findPublicUsers` **already** use `inArray(users.id, ids)` — the template to copy.
- `components/chat-room.tsx` `loadData` (lines ~62-82): `getConversation` then `getUsers` run **serially**; a second effect (`getDealStatus` → `getReviews`) is another serial chain.
- `app/(protected)/chat/page.tsx` (lines ~46-50) already fetches `getUsers({id: otherId})` + `getDealStatus(bidId)` in parallel — and `chat-room.tsx` re-fetches the **same** `getUsers(otherId)` (line 75) and `getDealStatus(bidId)` (in its second effect). Duplicate work per chat open.

## Design

### 1. Reusable `inArray` batch variants (repos + validators)
Extend the existing find-schemas and repos (mirror `findUserSchema`'s optional `ids`):
- `FindOffersSchema`/`FindRequestsSchema`: add `ids?: string[]`. Repo pushes `inArray(offers.id, ids)` when present (in addition to / instead of the scalar `id`).
- `FindOfferBidsSchema`/`FindRequestBidsSchema`: add `offer_ids?: string[]` / `request_ids?: string[]`. Repo pushes `inArray(offer_bids.offer_id, offer_ids)` / `inArray(request_bids.request_id, request_ids)`.
- **Empty-array safety (critical):** when a batch field is present but empty, the repo must return `[]` — it must NEVER fall through to an unfiltered full-table scan. This is a guarded branch with an explicit unit test.
- No new action names — the existing `getOffers`/`getRequests`/`getOfferBids`/`getRequestBids` actions accept the new optional fields. Chat and future callers reuse these.

### 2. `getTrackerData` server-side aggregation
New `getTrackerData(userId)` — action (`lib/actions/tracker.ts`) → service (`lib/services/tracker.service.ts`) → the batched repo functions from §1 + `usersRepo`. One action, one `requireAuth()`. Internally (all server-side, same pooled connection, no per-query auth/HTTP):
1. 4 base queries: owned offers, owned requests, my offer-bids, my request-bids (parallel).
2. Batched hydration: `findOffers({ ids: myOfferBids.map(offer_id) })`, `findRequests({ ids: myReqBids.map(request_id) })`, `findOfferBids({ offer_ids: ownedOffers.map(id) })`, `findRequestBids({ request_ids: ownedRequests.map(id) })`.
3. One `findUsers({ ids })` for every counterparty id across all bids.
4. Group in memory (a pure, tested `groupBidsByParent` helper) and return shaped collections:
   ```
   type TrackerData = {
     ownedOffers:   (SelectOffer   & { bids: { bid: SelectOfferBid;   user: TrackerUser }[] })[];
     ownedRequests: (SelectRequest & { bids: { bid: SelectRequestBid; user: TrackerUser }[] })[];
     bidOffers:     { bid: SelectOfferBid;   offer:   SelectOffer   | null }[];
     bidRequests:   { bid: SelectRequestBid; request: SelectRequest | null }[];
   };
   type TrackerUser = { id: string; name: string | null };
   ```
**Client round-trips for the whole tracker: 1** (down from ~21).

### 3. Tracker page consumes the aggregate
`fetchTrackerData` becomes a single `getTrackerData(userId)` call; the existing in-memory mapping into `TrackerOffer`/`TrackerRequest`/`TrackerCard` is preserved but now reads from `TrackerData`'s already-grouped, already-named collections (no fan-out, no client-side `getUsers`). `useUnreadCounts` and all rendering/behavior stay unchanged.

### 4. Chat parallelize + dedupe
- `chat-room.tsx` `loadData`: run `getConversation` in parallel with whatever else it still needs (see below) via `Promise.all`.
- Kill the page↔room duplication: `ChatRoom` gains optional props `otherName?`, `otherAvatarUrl?`, and the deal-status fields the room needs; `chat/page.tsx` passes what it already fetched. The room stops calling `getUsers(otherId)` and `getDealStatus(bidId)` when the props are supplied (fetch remains as a fallback only if a prop is absent). The room still owns `getConversation` (messages) and its realtime subscription.

## Testing

- **Unit (pure, TDD):**
  - Batch repo empty-array safety — assert an empty `ids`/`offer_ids`/`request_ids` yields `[]` (guard against table scan). (Repo functions are thin; test the guard via the query-builder branch or a small extracted predicate.)
  - `groupBidsByParent(parents, bids, users)` — groups bids under their parent, attaches the right user, handles a parent with zero bids and a bid whose parent/user is missing.
- **Manual QA:** tracker renders identically (owned + bid-on cards, counterparty names, unread badges, chat-list modal) at mobile + widescreen; chat header + room show the other user and deal status with no visual regression; verify via network panel that the tracker is ~1 action and a chat open no longer double-fetches user/deal-status.

## Risks & verification
- **Behavior parity (highest):** the tracker refactor must produce byte-identical card data — same owned/bid-on grouping, counterparty names, statuses, badge counts. Verify against the current page before/after.
- **Empty-array table scan:** the single most dangerous batch bug — explicitly tested.
- **Chat prop fallback:** if a prop isn't passed, the room must still work (fallback fetch) so nothing breaks mid-refactor.
- **No auth change:** confirm `getTrackerData` still calls `requireAuth()` once; no route becomes unguarded.

## Non-goals
- `requireAuth` amplifier, feed, pagination/virtualization, lazy per-card loading (all rejected above).
- No schema/migration changes.
