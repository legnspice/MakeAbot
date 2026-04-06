# Frontend Bug Fixes & UX Improvements

**Date**: 2026-04-06
**Scope**: 9 frontend-only fixes from user feedback. Price range (DB migration) deferred.

---

## Fix 1: Image display — no cropping

**Files**: `create-offer/page.tsx`, `create-request/page.tsx`, `item-detail-modal.tsx`

- Create form preview: `object-cover` → `object-contain` with `bg-gray-100` backdrop
- Detail modal: same — `object-cover` → `object-contain`
- Users see the full image without cropping

## Fix 2: Description formatting preserved

**Files**: `item-detail-modal.tsx`, `item.tsx`

- Add `whitespace-pre-wrap` to description text so line breaks from the textarea are preserved when displayed

## Fix 3: Disable clicking own posts

**Files**: `app/(protected)/(home)/page.tsx`

- When `item.userId === currentUser.id`, set `onClick` to `undefined`
- Add visual indicator (e.g., "Your post" label or reduced hover effect)

## Fix 4: Chat initialization bug

**Files**: `hooks/use-realtime-chat.tsx`

- Root cause: `createClient()` called at component level creates new ref every render, triggering useEffect cleanup/re-subscribe and resetting `isConnected`
- Fix: move `createClient()` into a `useRef` so the Supabase client is stable across renders

## Fix 5: Fixed height cards

**Files**: `components/ui/item.tsx`

- Add fixed height to cards with overflow hidden and content truncation
- Prevents cards from stretching when a neighbor has long content

## Fix 6: Show post image on home feed cards

**Files**: `components/ui/item.tsx`

- Render `detail.imageUrl` as a thumbnail at the top of each card when present
- Use `object-contain` with gray backdrop, consistent with Fix 1

## Fix 7: Tutorial back button

**Files**: `components/tutorial-modal.tsx`

- Add a "Back" button so users can navigate to previous steps
- Show "Back" when `step > 0`, keep "Skip tutorial" visible throughout

## Fix 8: Profile picture — resolution fix + upload

**Files**: `app/(protected)/profile/page.tsx`

- Resolution: transform Google avatar URLs — replace `=s96-c` with `=s400-c` for higher res
- Upload: add camera icon overlay on avatar, file picker → compress → upload to Supabase `profile_photos` bucket → update via `supabase.auth.updateUser({ data: { avatar_url: newUrl } })`
- No DB migration — uses Supabase auth metadata

## Fix 9: Center create modal

**Files**: `app/(protected)/(home)/page.tsx`

- Change type picker modal from `bottom-17` to centered on mobile
- Use `inset-0 flex items-center justify-center` matching desktop behavior
