# C3b — Public Profiles & Card Entry Points — Design Spec

**Date:** 2026-07-26
**Epic:** C3b (builds on C3a avatar denormalization)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Add read-only public profiles (`/profile/[userId]`) with **contextual disclosure** of contact info, a **reviews list** on both own and public profiles, and profile **entry points** across the app (card poster name + avatar, chat, item-detail modal).

Source: placeholder items 4 (public profiles), 10 (reviews section), 38 (rounded mobile pic — already `rounded-full` on dev, verify/skip). Plus the user's adds: card name → profile links, card real-photo avatars.

## Key facts (verified in code)

- dev's own profile `app/(protected)/profile/page.tsx` is a monolithic client component: avatar (rounded, upload), name, rating badge (stars + count), phone, ID, bio, "N completed transactions", logout, edit modal, and a **"Current Offers"** section — but **no reviews list**. Mobile avatar is already `rounded-full` (line 328).
- `reviews` table (`lib/db/schema.ts:57`): `rated_user_id`, `creator_id` (reviewer), `rating`, `comment`, `created_at`. `getReviews({ rated_user_id })` exists.
- `offer_bids` (`offer_id`, `bidder_id`) / `request_bids` (`request_id`, `bidder_id`); offers/requests have `user_id` (owner).
- Feed `ListItem` carries `userId` (poster); tracker cards have `counterparty.id`. `ItemRequestCard` gets the poster via the `requestedBy` string only.
- Card is shared by feed + tracker. C3a makes `avatar_url` available on `users` rows (batched via `getUsers`).

## Design

### 1. Public profile route
`app/(protected)/profile/[userId]/page.tsx` (client). On load, if `userId === currentUser.id` → `router.replace("/profile")`. Otherwise fetch in parallel:
- `getUsers({ id: userId })` → name, bio, id_number, phone_number, `avatar_url`, contributions
- `getReviews({ rated_user_id: userId })` → reviews received
- `getOffers({ user_id: userId, status: "Active" })` → their current offers
- `getRelationship(userId)` → boolean

Render a **read-only** version of the profile layout (no edit / logout / avatar upload):
- Always: avatar (`users.avatar_url`, initial fallback), name, rating badge (reuse existing stars), bio, "N completed transactions", Current Offers, **Reviews** section.
- **Contextual disclosure:** show phone + ID **only if `getRelationship` is true**; otherwise omit those rows.

### 2. `getRelationship` (contextual disclosure)
New server action `getRelationship(otherId): boolean` (`lib/actions/users.ts` or `deals.ts`), backed by repo `relationshipExists(a, b)`:
- true if a bid links the two users either direction:
  `offer_bids ob JOIN offers o ON ob.offer_id=o.id WHERE (ob.bidder_id=a AND o.user_id=b) OR (ob.bidder_id=b AND o.user_id=a)` — LIMIT 1, UNION the same for `request_bids`/`requests`.
- Any bid counts (active or completed) — the decided trigger.

### 3. Reviews section (shared component)
`components/reviews-list.tsx` — `ReviewsList({ reviews, reviewerNames, reviewerAvatars })`:
- Batch-fetch reviewer identities via `getUsers({ ids: reviews.map(r => r.creator_id) })` (name + `avatar_url`).
- Render each: reviewer avatar (initial fallback) · name · star rating · comment · **relative date**.
- Empty state: "No reviews yet."
- Used by **both** the `[userId]` page and the existing own `/profile` page (adds the reviews list to own profile — item 10).
- Relative-date helper `lib/date.ts` `timeAgo(date)` (pure, unit-tested: "just now", "3h ago", "2d ago", "Aug 2").

### 4. Card entry points (name link + avatar)
`ItemRequestCard` (`components/ui/item.tsx`) gains: `posterId?: string`, `posterName?: string`, `posterAvatarUrl?: string`, `isOwnPoster?: boolean`.
- Replace the plain "Offered/Requested by: X" text with: a small avatar (photo from `posterAvatarUrl`, else initial) + the **name as a `next/link` to `/profile/[posterId]`**.
- The name link calls `e.stopPropagation()` so tapping it navigates to the profile while tapping elsewhere on the card still opens the detail modal (nested interactive — guard required).
- Own items (`isOwnPoster`/"You") render the name **without** a link.
- Thread the data: feed mapping passes `posterId = item.userId` + `posterAvatarUrl` (from the batched `getUsers` `avatar_url`); tracker passes `counterparty.id` + avatar.

### 5. Other nav entry points
- **Chat**: the other user's avatar/name in the chat header (and optionally message avatars) → `/profile/[otherId]`.
- **Item detail modal**: the poster's `lentBy`/`requestedBy` name → `/profile/[posterId]` (thread `posterId` into `ItemDetailData`).

### 6. Item 38
Verify dev's mobile profile avatar is `rounded-full` (it is at `profile/page.tsx:328`) → no change; note as done.

## Non-goals / dependencies
- Depends on **C3a** (`users.avatar_url` + batched avatars). Build C3a first.
- No refactor of the monolithic own-profile page beyond adding the `ReviewsList` section.
- Review **dedupe** (DB unique index) is a separate C2 leftover, not this spec.

## Risks & verification
- **Nested interactive:** verify the card name-link navigates to the profile and does NOT also open the detail modal (stopPropagation), at mobile + widescreen.
- **`getRelationship` correctness:** counterparty sees phone/ID; a stranger does not; you see your own everything. Verify both bid directions (you-bid-on-them and they-bid-on-you).
- **Privacy:** confirm phone + ID never render for non-counterparties on `/profile/[userId]`.
- Reviews list: reviewer names/avatars resolve via one batch call; relative dates read correctly.
- Manual QA at mobile + widescreen.
