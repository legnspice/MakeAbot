# Tracker Page Redesign

## Summary

Redesign the tracker page to use the same rich card layout as the home page (`ItemRequestCard`) with Edit/Delete buttons on owned items. Clicking a card opens the chat list modal showing users who inquired. Edit navigates to the create-offer/create-request page in edit mode (pre-filled). Delete hard-deletes the item after confirmation.

## Scope

- Tracker page UI overhaul
- `ItemRequestCard` component: add `onEdit`/`onDelete` support
- Create-offer page: add edit mode (pre-fill from existing post)
- Create-request page: add edit mode (pre-fill from existing request)

No new server actions needed — `editPost`, `editRequest`, `removePost`, `removeRequest` already exist.

## Changes

### 1. `ItemRequestCard` (`components/ui/item.tsx`)

Add optional props:
- `onEdit?: () => void`
- `onDelete?: () => void`

When either is present, render Edit and Delete buttons in the card's bottom-left area (next to price). Both buttons are small, outlined. Delete has red text. Buttons call `e.stopPropagation()` to avoid triggering the card's `onClick`.

Layout stays the same: image left, content right. The bottom row becomes `[Edit] [Delete] ... [price]` for owned items, or just `[price]` for non-owned items.

### 2. Tracker Page (`app/(protected)/tracker/page.tsx`)

**Data model changes:**

Extend `TrackerOffer` and `TrackerRequest` types to include full item details needed by `ItemRequestCard`:
- `description`, `imageUrl`, `price` (for offers), `type`
- `isOwned: boolean` — whether the current user owns this item

**Fetching:**

The `fetchTrackerData` function already fetches full post/request objects. Pass through `description`, `imgUrl`, `price`/`fee` to the tracker card types.

**Rendering:**

Replace inline `OfferCard`/`RequestCard` components with `ItemRequestCard`:
- `variant`: `"lent"` for offers, `"requested"` for requests
- `typeBadge`: `"Offer"` or `"Request"`
- `requestedBy`: poster name (for bid-on items) or "You" (for owned items)
- `price`: formatted price
- `detail`: `{ title, description, imageUrl, price, quantity: 1 }`
- `onClick`: opens `ChatListModal` (existing behavior)
- `onEdit` (owned only): navigates to `/create-offer?edit=<id>` or `/create-request?edit=<id>`
- `onDelete` (owned only): shows confirmation dialog, calls `removePost`/`removeRequest`, removes card from state

**Delete confirmation:**

Simple `window.confirm("Are you sure you want to delete this item?")` before calling the server action. On success, remove the item from the `offers`/`requests` state arrays.

**Remove inline components:**

Delete the `OfferCard`, `RequestCard`, and `ChatListModal` inline components — `ChatListModal` stays but gets simplified since the card component handles display.

Actually, `ChatListModal` is still needed for the "who inquired" list. Keep it. Remove only `OfferCard` and `RequestCard`.

### 3. Create-Offer Edit Mode (`app/(protected)/(home)/create-offer/page.tsx`)

- Read `edit` query param via `useSearchParams()`
- If `edit` param exists, fetch the post by ID on mount using `getPosts({ id: editId })`
- Pre-fill form state: `title`, `description`, `price`, `type`, image URL
- Change page title from "Create an Offer" to "Edit Offer"
- Change submit button from "Create" to "Save"
- On submit: call `editPost(id, data)` instead of `createPost(data)`
- If image changed, upload new image; if not, keep existing `imgUrl`

### 4. Create-Request Edit Mode (`app/(protected)/(home)/create-request/page.tsx`)

Same pattern as create-offer:
- Read `edit` query param
- Fetch request by ID, pre-fill: `title`, `description`, `fee`, `urgency`, `type`, image
- Change title to "Edit Request", button to "Save"
- On submit: call `editRequest(id, data)` instead of `createRequest(data)`

## Files Modified

1. `components/ui/item.tsx` — add `onEdit`/`onDelete` props and buttons
2. `app/(protected)/tracker/page.tsx` — use `ItemRequestCard`, add delete logic, remove inline card components
3. `app/(protected)/(home)/create-offer/page.tsx` — add edit mode
4. `app/(protected)/(home)/create-request/page.tsx` — add edit mode

## Out of Scope

- Soft delete / archiving
- Inline editing on the tracker page
- Batch delete
- New server actions (all needed actions already exist)
