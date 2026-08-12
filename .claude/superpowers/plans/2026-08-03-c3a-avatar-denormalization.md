# C3a — Avatar Denormalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store each user's avatar on the `users` table (`avatar_url`) so it is batch-fetched with `getUsers`, and retire the slow per-user `getUserAvatarUrl` admin-API calls.

**Architecture:** Auth `user_metadata` stays the master avatar source. A new `users.avatar_url` column mirrors it, populated lazily by a fire-and-forget `syncAvatarUrl()` on protected load and eagerly on profile upload. Chat page + chat-room already call `getUsers({ id })` for the same user, so the avatar piggybacks on that existing batch call and `getUserAvatarUrl` is removed.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM, Supabase Auth, Zod, Jest.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`).
- Migrations via `drizzle-kit push` only — never `generate`+`migrate` (enum config breaks generate). The push itself is run by the user in their TTY (enum prompt); this plan does NOT run it.
- Layered backend: Server Action → Service → Repository → DB. Server actions wrap logic in `handleAction()` and call `requireAuth()`.
- `editUser`/`getUsers` already exist; reuse them rather than adding parallel write paths where possible.
- All UI changes must work at mobile + widescreen.
- `npm format` before any push (required).

---

### Task 1: Add `avatar_url` column to the `users` schema

**Files:**
- Modify: `lib/db/schema.ts:27-36` (the `users` table)

**Interfaces:**
- Produces: `users.avatar_url` (nullable `text`) on `SelectUser`/`InsertUser`, and therefore on every row returned by `getUsers`.

- [ ] **Step 1: Add the column**

In `lib/db/schema.ts`, inside the `users` table definition, add after `contributions`:

```ts
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => supabaseUsers.id, { onDelete: "cascade" }),
  name: text("name"),
  id_number: integer("id_number"),
  phone_number: text("phone_number"),
  description: text("description"),
  contributions: integer("contributions").notNull().default(0),
  avatar_url: text("avatar_url"), // denormalized mirror of auth metadata avatar
});
```

- [ ] **Step 2: Typecheck compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `schema.ts` (existing rows treat `avatar_url` as `string | null`).

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(schema): add users.avatar_url (denormalized avatar mirror)"
```

> **Note:** The actual `drizzle-kit push` to apply this column is run by the user (TTY). The app tolerates a missing column only at query time — do not block later tasks on the push; they compile and lint without it.

---

### Task 2: Add `avatar_url` to the user validation schema

**Files:**
- Modify: `lib/validation/users.ts:5-12` (`userSchema`)

**Interfaces:**
- Consumes: `users.avatar_url` from Task 1.
- Produces: `avatar_url` becomes a writable field on `UpdateUserSchema` (via the existing `updateUserSchema = userSchema.omit({ id: true }).partial()`), so `editUser(id, { avatar_url })` validates.

- [ ] **Step 1: Add the field to `userSchema`**

In `lib/validation/users.ts`, add `avatar_url` to `userSchema`:

```ts
export const userSchema = z.object({
  id: z.string().uuid({}),
  name: z.string().min(1, "Name is required").nullable(),
  id_number: z.int().nullable(),
  phone_number: z.string().nullable(),
  description: z.string().nullable(),
  contributions: z.int(),
  avatar_url: z.string().nullable(),
});
```

No change needed to `findUserSchema` or `updateUserSchema` — they derive from `userSchema` (the update pick auto-includes `avatar_url`; the find pick omits only `phone_number`).

- [ ] **Step 2: Typecheck compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validation/users.ts
git commit -m "feat(validation): allow avatar_url on user update schema"
```

---

### Task 3: `syncAvatarUrl` — decision helper (pure, TDD)

The sync must be idempotent — write only when the metadata avatar differs from the stored `users.avatar_url`. Extract that decision into a pure, unit-tested helper.

**Files:**
- Create: `lib/avatar.ts`
- Test: `__tests__/lib/avatar.test.ts`

**Interfaces:**
- Produces: `resolveMetaAvatar(meta): string | null` and `avatarNeedsSync(stored, next): boolean`, consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/avatar.test.ts`:

```ts
import { resolveMetaAvatar, avatarNeedsSync } from "@/lib/avatar";

describe("resolveMetaAvatar", () => {
  it("prefers avatar_url over picture", () => {
    expect(resolveMetaAvatar({ avatar_url: "a", picture: "p" })).toBe("a");
  });
  it("falls back to picture", () => {
    expect(resolveMetaAvatar({ picture: "p" })).toBe("p");
  });
  it("returns null when neither present", () => {
    expect(resolveMetaAvatar({})).toBeNull();
    expect(resolveMetaAvatar(undefined)).toBeNull();
  });
});

describe("avatarNeedsSync", () => {
  it("true when stored differs from next", () => {
    expect(avatarNeedsSync(null, "a")).toBe(true);
    expect(avatarNeedsSync("old", "new")).toBe(true);
  });
  it("false when equal (including both null)", () => {
    expect(avatarNeedsSync("a", "a")).toBe(false);
    expect(avatarNeedsSync(null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/avatar.test.ts`
Expected: FAIL — cannot find module `@/lib/avatar`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/avatar.ts`:

```ts
type Meta = { avatar_url?: unknown; picture?: unknown } | null | undefined;

export function resolveMetaAvatar(meta: Meta): string | null {
  if (!meta) return null;
  const v = meta.avatar_url ?? meta.picture;
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function avatarNeedsSync(
  stored: string | null | undefined,
  next: string | null,
): boolean {
  return (stored ?? null) !== next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/avatar.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/avatar.ts __tests__/lib/avatar.test.ts
git commit -m "feat(avatar): pure resolveMetaAvatar/avatarNeedsSync helpers (tested)"
```

---

### Task 4: `syncAvatarUrl` server action + service passthrough

**Files:**
- Modify: `lib/actions/users.ts` (add `syncAvatarUrl`)
- Modify: `lib/services/users.service.ts` (add `syncAvatarUrl`)
- Reuse: `usersRepo.findUsers` + `usersRepo.updateUser` (no new repo fn needed)

**Interfaces:**
- Consumes: `resolveMetaAvatar`, `avatarNeedsSync` (Task 3); `requireAuth()` (returns the Supabase auth user, which carries `user_metadata`).
- Produces: `syncAvatarUrl(): Promise<{ data: void; error?: string }>` server action (idempotent; ~0 writes when unchanged), consumed by Task 5.

- [ ] **Step 1: Add the service function**

In `lib/services/users.service.ts`, add:

```ts
export async function syncAvatarUrl(id: string, next: string | null) {
  const rows = await usersRepo.findUsers({ id });
  const stored = rows[0]?.avatar_url ?? null;
  if (!avatarNeedsSync(stored, next)) return;
  await usersRepo.updateUser(id, { avatar_url: next });
}
```

Add the import at the top:

```ts
import { avatarNeedsSync } from "../avatar";
```

- [ ] **Step 2: Add the server action**

In `lib/actions/users.ts`, add (and import `resolveMetaAvatar`):

```ts
import { resolveMetaAvatar } from "@/lib/avatar";

export async function syncAvatarUrl() {
  return await handleAction(async () => {
    const user = await requireAuth();
    const next = resolveMetaAvatar(user.user_metadata);
    await usersService.syncAvatarUrl(user.id, next);
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/users.ts lib/services/users.service.ts
git commit -m "feat(users): syncAvatarUrl action — lazily mirror auth avatar to users.avatar_url"
```

---

### Task 5: Call `syncAvatarUrl` fire-and-forget on protected load

**Files:**
- Modify: `contexts/auth-context.tsx`

**Interfaces:**
- Consumes: `syncAvatarUrl()` (Task 4); `resolveMetaAvatar`, `avatarNeedsSync` (Task 3).

`AuthProvider` wraps every protected page and already receives `userData` — which carries **both** the stored column (`userData.publicUser.avatar_url`, after Task 1) and the master (`userData.supabaseUser.user_metadata`). So the staleness check is a free in-memory string compare on the client; we only call the server action when they actually differ. This avoids a DB read on every load and still refreshes on first-login backfill *and* a changed Google photo. Fire-and-forget (never blocks render; a failure is silent — the row just stays stale until next load).

- [ ] **Step 1: Add the guarded effect**

Edit `contexts/auth-context.tsx` — extend the import and add the effect inside `AuthProvider`:

```tsx
import { createContext, useContext, ReactNode, useMemo, useEffect } from "react";
import { CurrentUserData } from "@/hooks/use-current-user";
import { syncAvatarUrl } from "@/lib/actions/users";
import { resolveMetaAvatar, avatarNeedsSync } from "@/lib/avatar";
```

Inside `AuthProvider`, before the `return`:

```tsx
  // Mirror the auth-metadata avatar into users.avatar_url only when it has drifted.
  // The compare uses data already in memory (no DB read); the server action fires
  // fire-and-forget only on a real change (first-login backfill or a new Google photo).
  useEffect(() => {
    const next = resolveMetaAvatar(userData.supabaseUser.user_metadata);
    if (avatarNeedsSync(userData.publicUser.avatar_url, next)) {
      void syncAvatarUrl();
    }
  }, [userData]);
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add contexts/auth-context.tsx
git commit -m "feat(auth): sync avatar_url on protected load (fire-and-forget)"
```

---

### Task 6: Eager write on profile avatar upload

**Files:**
- Modify: `app/(protected)/profile/page.tsx:101-105` (`handleAvatarUpload`)

**Interfaces:**
- Consumes: `editUser` (already imported at line 21).

Keep the mirror current immediately after upload, before the reload, so the denormalized value is fresh even if the sync-on-load hasn't run yet.

- [ ] **Step 1: Write the mirror after the metadata update**

In `handleAvatarUpload`, after `supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })` and before `window.location.reload()`:

```ts
      await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl },
      });

      // Keep the denormalized users.avatar_url in sync immediately.
      await editUser(currentUser.id, { avatar_url: data.publicUrl });

      window.location.reload();
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/profile/page.tsx"
git commit -m "feat(profile): mirror avatar to users.avatar_url on upload"
```

---

### Task 7: Retire `getUserAvatarUrl` in the chat page

**Files:**
- Modify: `app/(protected)/chat/page.tsx:12,42-66`

**Interfaces:**
- Consumes: `getUsers({ id: otherId })` result now carries `avatar_url` (Tasks 1-2).

- [ ] **Step 1: Drop the admin call; read avatar from the users row**

In `app/(protected)/chat/page.tsx`:

Change the import (line 12) from:

```ts
import { getUsers, getUserAvatarUrl } from "@/lib/actions/users";
```
to:
```ts
import { getUsers } from "@/lib/actions/users";
```

Replace the `Promise.all` block (lines 45-65) so it no longer calls `getUserAvatarUrl` and takes the avatar from the users row:

```ts
    Promise.all([
      getDealStatus(bidId, kind),
      getReviews({ rated_user_id: otherId }),
      getUsers({ id: otherId }),
    ]).then(([statusResult, reviewsResult, usersResult]) => {
      if (statusResult.data) {
        setOwnerUserId(statusResult.data.ownerUserId);
        setParentId(statusResult.data.parentId);
        const s = statusResult.data.parentStatus;
        if (s === "Completed" || s === "Closed") setIsDone(true);
      }
      const reviews = reviewsResult.data ?? [];
      if (reviews.length > 0) {
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        setOtherRating(Math.round(avg * 10) / 10);
      }
      const user = usersResult.data?.[0];
      if (user) {
        setOtherName(user.name ?? "");
        setOtherAvatarUrl(user.avatar_url ?? null);
      }
    });
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors; no remaining `getUserAvatarUrl` reference in this file.

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/chat/page.tsx"
git commit -m "perf(chat): read other-user avatar from users.avatar_url (drop admin call)"
```

---

### Task 8: Retire `getUserAvatarUrl` in chat-room

**Files:**
- Modify: `components/chat-room.tsx:10,75-81`

**Interfaces:**
- Consumes: `getUsers({ id: other_user_id })` result now carries `avatar_url`.

- [ ] **Step 1: Drop the admin call; read avatar from the users row**

In `components/chat-room.tsx`:

Change the import (line 10) from:

```ts
import { getUsers, getUserAvatarUrl } from "@/lib/actions/users";
```
to:
```ts
import { getUsers } from "@/lib/actions/users";
```

Replace the users-fetch + avatar block (lines 75-81):

```ts
      const result2 = await getUsers({ id: other_user_id });
      if (result2.data && result2.data.length > 0) {
        setOtherUserName(result2.data[0].name || "Unknown User");
        setOtherAvatarUrl(result2.data[0].avatar_url ?? undefined);
      }

      setChatDataLoading(false);
```

(Delete the now-removed `const avatar = await getUserAvatarUrl(...)` / `if (avatar) setOtherAvatarUrl(avatar)` lines.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors; no remaining `getUserAvatarUrl` reference in this file.

- [ ] **Step 3: Commit**

```bash
git add components/chat-room.tsx
git commit -m "perf(chat-room): read avatar from users.avatar_url (drop admin call)"
```

---

### Task 9: Remove the now-unused `getUserAvatarUrl` action

**Files:**
- Modify: `lib/actions/users.ts:31-39`

**Interfaces:**
- Precondition: Tasks 7-8 removed the only two callers.

- [ ] **Step 1: Confirm there are no remaining callers**

Run: `git grep -n getUserAvatarUrl -- '*.ts' '*.tsx'`
Expected: matches only in `lib/actions/users.ts` (the definition). If any other file matches, migrate it the same way as Tasks 7-8 before deleting.

- [ ] **Step 2: Delete the function**

In `lib/actions/users.ts`, remove the entire `getUserAvatarUrl` function (lines 31-39). If `createAdminClient` is now unused in the file, remove its import (`import { createAdminClient } from "@/lib/supabase/admin";`).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors; no unused-import warnings.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/users.ts
git commit -m "chore(users): remove unused getUserAvatarUrl (no admin-API avatar calls)"
```

---

### Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the new `avatar.test.ts`.

- [ ] **Step 2: Lint + format**

Run: `npm run lint && npm format`
Expected: clean.

- [ ] **Step 3: Manual QA checklist (after the user runs `drizzle-kit push`)**

- [ ] `users.avatar_url` column exists; existing rows are `NULL`.
- [ ] Open a chat: the other user's avatar renders (now sourced from `users.avatar_url`); falls back to the initial letter when null.
- [ ] Upload a new profile photo → after reload, that user's avatar shows in chat headers without a full re-login.
- [ ] `git grep getUserAvatarUrl` returns nothing.
- [ ] Verify at mobile + widescreen.

---

## Notes / dependencies

- **Blocking dependency:** the `avatar_url` column must be applied via `drizzle-kit push` (user's TTY) before runtime avatar reads resolve; bundle it with the pending `incentive` push. Code in Tasks 1-9 compiles and lints without the push.
- **C3b** (public profiles + card avatars) builds on this: card avatars consume `users.avatar_url` batched via `getUsers`. Do not add card avatars here.
- New-user edge case: `avatar_url` is `null` until the first `syncAvatarUrl` runs on load — UI falls back to the initial-letter avatar (acceptable).
