# C3a — Avatar Denormalization & Optimization — Design Spec

**Date:** 2026-07-26
**Epic:** C3a (foundation for C3b Profiles)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Store each user's avatar on the `users` table (`avatar_url`) so it can be **batch-fetched** with `getUsers`, and retire the slow per-user `getUserAvatarUrl` admin-API calls. This unblocks real-photo avatars on feed/tracker cards (C3b) without an N+1.

## Key facts (verified in code)

- Avatars currently live **only in Supabase auth `user_metadata`** (`avatar_url` from profile upload, `picture`/`avatar_url` from Google OAuth). The public `users` table has **no** avatar column.
- `getUserAvatarUrl(userId)` (`lib/actions/users.ts:31`) = `createAdminClient()` → `admin.auth.admin.getUserById(userId)` → reads `user_metadata.avatar_url ?? picture`. **One admin-API round-trip per user** (slow).
- Callers: `app/(protected)/chat/page.tsx:47` (`getUserAvatarUrl(otherId)`) and `components/chat-room.tsx:80` (`getUserAvatarUrl(other_user_id)`). **Both already call `getUsers({ id })` for the same user** (chat page line 49; chat-room line 74) — so the avatar can piggyback on that batch call.
- Profile avatar upload (`app/(protected)/profile/page.tsx:75-113`): uploads to `profile_photos` storage, then `supabase.auth.updateUser({ data: { avatar_url } })`, then `window.location.reload()`.
- `getUsers({ ids })` batch-returns full `users` rows.

## Design

### 1. Schema
Add to `users` (`lib/db/schema.ts`):
```
avatar_url: text("avatar_url"),   // denormalized mirror of auth metadata avatar
```
Apply via `drizzle-kit push` (bundle with the pending `incentive` push).

### 2. Validation
`lib/validation/users.ts`: add `avatar_url: z.string().nullable()` to the user schema and to the `editUser` update pick (so the service can write it).

### 3. Sync-on-load (auth metadata → users.avatar_url)
Auth metadata stays the **master** (Google + uploads both land there). Mirror it lazily:
- New server action `syncAvatarUrl()` (`lib/actions/users.ts`): `requireAuth()` → read the session user's `user_metadata.avatar_url ?? picture` → if it differs from `users.avatar_url` for that id, update the row. Returns void. Idempotent; ~0 writes when unchanged.
- Call it **fire-and-forget once on protected load** — in `contexts/auth-context.tsx` (AuthProvider mount) or `app/(protected)/layout.tsx`. This lazily backfills every existing user on their next visit.
- Repo: `updateUserAvatarUrl(userId, url)` (or reuse the existing user update). Service passthrough.

### 4. Immediate write on upload
In `profile/page.tsx` `handleAvatarUpload`, after `supabase.auth.updateUser(...)`, also `await editUser(currentUser.id, { avatar_url: data.publicUrl })` so the mirror is current even before the reload/sync.

### 5. Optimize the callers (retire `getUserAvatarUrl`)
- `chat/page.tsx`: drop `getUserAvatarUrl(otherId)` from the `Promise.all`; take the avatar from the existing `getUsers({ id: otherId })` result's `avatar_url`.
- `chat-room.tsx`: drop `getUserAvatarUrl(other_user_id)`; use the existing `getUsers({ id: other_user_id })` result's `avatar_url`.
- Remove `getUserAvatarUrl` (and its `createAdminClient` usage) once no callers remain. No more admin-API avatar calls.

### 6. Backfill
Existing users populate lazily via `syncAvatarUrl` on next load. (Optional one-time Supabase SQL backfill from `auth.users` metadata — note, not required.)

## Non-goals
- No change to how avatars are uploaded/stored (still `profile_photos` + auth metadata master).
- Card avatars themselves are **C3b** (this spec only makes `avatar_url` available + optimizes existing calls).

## Risks & verification
- **Sync timing:** a brand-new user's `avatar_url` is null until the first `syncAvatarUrl` runs (on load) — acceptable; UI falls back to the initial-letter avatar.
- **Push:** verify `avatar_url` column added to `users`; existing rows get `NULL`.
- Verify chat page + chat-room still show the other user's avatar (now from `users.avatar_url`), and no `getUserAvatarUrl` references remain.
- Tests: optional pure helper for "did the avatar change" is trivial; the rest is DB/session — verify via manual QA.
