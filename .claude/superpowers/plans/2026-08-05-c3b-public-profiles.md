# C3b — Public Profiles & Card Entry Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only public profile at `/profile/[userId]` with contextual disclosure of contact info, a shared reviews list on both public and own profiles, and profile entry points from feed cards, the item-detail modal, and the chat header.

**Architecture:** Contextual disclosure is enforced **server-side** via a new `getPublicProfile(userId)` action that redacts `phone_number`/`id_number` to `null` unless the viewer is a counterparty (a bid links the two users either direction) or self — so private data never reaches a stranger's client. A shared self-contained `ReviewsList` client component batch-fetches reviewer identities. Feed cards, the detail modal, and the chat header gain `next/link` navigation to profiles, guarded with `stopPropagation` where nested inside a clickable card.

**Tech Stack:** Next.js 16 App Router (React 19, client components + server actions), Drizzle ORM, Supabase, Zod, Jest.

## Global Constraints

- Branch: `feature/qa-fixes-v2` (off `dev`). Do NOT create a new branch.
- **No schema migration / no `drizzle-kit push` for C3b** — it consumes the `avatar_url` column added by C3a (whose push is still pending in the user's TTY). The only schema-file change is exporting a `SelectReview` type (no DB change).
- Layered backend: Server Action → Service → Repository → DB. Actions wrap in `handleAction()` and call `requireAuth()`; the viewer identity always comes from `requireAuth()`, never a client-supplied id.
- **Privacy:** `phone_number` and `id_number` must never be sent to a non-counterparty's client — enforce in the data layer, not just the UI.
- All UI must work at mobile + widescreen. Avatars are `rounded-full` with an initial-letter fallback when no photo.
- Poster brand colors: offer amber `#DEA440`, request blue `#3761B0`.
- `npm format` before any push (required).
- Pre-existing repo-wide lint debt exists; only your touched files must be lint-clean (0 new errors).

## Item 38 (rounded mobile profile pic)
Already `rounded-full` on dev (`app/(protected)/profile/page.tsx` mobile avatar). No code change — verified done.

---

### Task 1: `timeAgo` relative-date helper (pure, TDD)

**Files:**
- Create: `lib/date.ts`
- Test: `__tests__/lib/date.test.ts`

**Interfaces:**
- Produces: `timeAgo(date: Date | string, now?: Date): string` — consumed by `ReviewsList` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/date.test.ts`:

```ts
import { timeAgo } from "@/lib/date";

const NOW = new Date("2026-08-05T12:00:00Z");

describe("timeAgo", () => {
  it("returns 'just now' under a minute", () => {
    expect(timeAgo(new Date("2026-08-05T11:59:30Z"), NOW)).toBe("just now");
  });
  it("minutes", () => {
    expect(timeAgo(new Date("2026-08-05T11:45:00Z"), NOW)).toBe("15m ago");
  });
  it("hours", () => {
    expect(timeAgo(new Date("2026-08-05T09:00:00Z"), NOW)).toBe("3h ago");
  });
  it("days", () => {
    expect(timeAgo(new Date("2026-08-03T12:00:00Z"), NOW)).toBe("2d ago");
  });
  it("falls back to a short date beyond 7 days", () => {
    // 2026-07-20 is >7d before NOW → 'Jul 20'
    expect(timeAgo(new Date("2026-07-20T12:00:00Z"), NOW)).toBe("Jul 20");
  });
  it("accepts an ISO string", () => {
    expect(timeAgo("2026-08-05T11:59:30Z", NOW)).toBe("just now");
  });
  it("future or invalid dates clamp to 'just now'", () => {
    expect(timeAgo(new Date("2026-08-05T12:05:00Z"), NOW)).toBe("just now");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/date.test.ts`
Expected: FAIL — cannot find module `@/lib/date`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/date.ts`:

```ts
export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const ms = now.getTime() - then.getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/date.test.ts`
Expected: PASS (7 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/date.ts __tests__/lib/date.test.ts
git commit -m "feat(date): timeAgo relative-date helper (tested)"
```

---

### Task 2: Contextual-disclosure backend — `relationshipExists` + `getPublicProfile`

**Files:**
- Create: `lib/repo/relationships.repo.ts`
- Modify: `lib/services/users.service.ts` (add `getPublicProfile`)
- Modify: `lib/actions/users.ts` (add `getPublicProfile` action)

**Interfaces:**
- Consumes: existing `usersRepo.findUsers`, the `offers`/`offer_bids`/`requests`/`request_bids` tables, `requireAuth()`.
- Produces:
  - `relationshipExists(a: string, b: string): Promise<boolean>` — true iff a bid links the two users in either direction (any status).
  - `usersService.getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile | null>`.
  - Server action `getPublicProfile(userId: string)` returning `{ data: PublicProfile | null; error?: string }`.
  - `PublicProfile` shape: `{ id: string; name: string | null; description: string | null; contributions: number; avatar_url: string | null; phone_number: string | null; id_number: number | null; related: boolean }`. `phone_number`/`id_number` are `null` unless `related`.

- [ ] **Step 1: Create the relationship repo**

Create `lib/repo/relationships.repo.ts`:

```ts
import { db } from "../db";
import { offers, offer_bids, requests, request_bids } from "../db/schema";
import { and, or, eq } from "drizzle-orm";

/** True iff a bid links users a and b in either direction (bidder↔owner), any status. */
export async function relationshipExists(a: string, b: string): Promise<boolean> {
  const offerMatch = await db
    .select({ id: offer_bids.id })
    .from(offer_bids)
    .innerJoin(offers, eq(offer_bids.offer_id, offers.id))
    .where(
      or(
        and(eq(offer_bids.bidder_id, a), eq(offers.user_id, b)),
        and(eq(offer_bids.bidder_id, b), eq(offers.user_id, a)),
      ),
    )
    .limit(1);
  if (offerMatch.length > 0) return true;

  const requestMatch = await db
    .select({ id: request_bids.id })
    .from(request_bids)
    .innerJoin(requests, eq(request_bids.request_id, requests.id))
    .where(
      or(
        and(eq(request_bids.bidder_id, a), eq(requests.user_id, b)),
        and(eq(request_bids.bidder_id, b), eq(requests.user_id, a)),
      ),
    )
    .limit(1);
  return requestMatch.length > 0;
}
```

- [ ] **Step 2: Add the service function**

In `lib/services/users.service.ts`, add the import and function:

```ts
import * as relationshipsRepo from "../repo/relationships.repo";

export type PublicProfile = {
  id: string;
  name: string | null;
  description: string | null;
  contributions: number;
  avatar_url: string | null;
  phone_number: string | null;
  id_number: number | null;
  related: boolean;
};

export async function getPublicProfile(
  viewerId: string,
  userId: string,
): Promise<PublicProfile | null> {
  const rows = await usersRepo.findUsers({ id: userId });
  const u = rows[0];
  if (!u) return null;
  const related =
    viewerId === userId ||
    (await relationshipsRepo.relationshipExists(viewerId, userId));
  return {
    id: u.id,
    name: u.name,
    description: u.description,
    contributions: u.contributions,
    avatar_url: u.avatar_url,
    // contextual disclosure — private fields only for counterparties (or self)
    phone_number: related ? u.phone_number : null,
    id_number: related ? u.id_number : null,
    related,
  };
}
```

- [ ] **Step 3: Add the server action**

In `lib/actions/users.ts`, add:

```ts
export async function getPublicProfile(userId: string) {
  return await handleAction(async () => {
    const viewer = await requireAuth();
    return usersService.getPublicProfile(viewer.id, userId);
  });
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/repo/relationships.repo.ts lib/services/users.service.ts lib/actions/users.ts
git commit -m "feat(users): getPublicProfile with server-side contextual disclosure of phone/ID"
```

---

### Task 3: `ReviewsList` shared component

**Files:**
- Modify: `lib/db/schema.ts` (export `SelectReview`)
- Create: `components/reviews-list.tsx`

**Interfaces:**
- Consumes: `timeAgo` (Task 1); `getUsers` (`@/lib/actions/users`); `getReviews` returns rows shaped like `SelectReview` (`rated_user_id`, `creator_id`, `rating`, `comment`, `created_at`, `id`).
- Produces: `ReviewsList({ reviews }: { reviews: SelectReview[] })` — a self-contained client component that batch-fetches reviewer name+avatar and renders the list. Consumed by Tasks 4 and 5.

- [ ] **Step 1: Export the `SelectReview` type**

In `lib/db/schema.ts`, next to the other `Select*` exports (near line 183-195), add:

```ts
export type SelectReview = typeof reviews.$inferSelect;
```

- [ ] **Step 2: Create the component**

Create `components/reviews-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { StarFill, Star } from "react-bootstrap-icons";
import type { SelectReview } from "@/lib/db/schema";
import { getUsers } from "@/lib/actions/users";
import { timeAgo } from "@/lib/date";

type Reviewer = { name: string | null; avatar_url: string | null };

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-xs font-medium text-gray-500 uppercase">
      {url ? (
        <Image src={url} alt={name ?? "User"} width={32} height={32} className="object-cover w-full h-full" />
      ) : (
        (name ?? "U").charAt(0)
      )}
    </div>
  );
}

export default function ReviewsList({ reviews }: { reviews: SelectReview[] }) {
  const [reviewers, setReviewers] = useState<Record<string, Reviewer>>({});

  useEffect(() => {
    const ids = Array.from(new Set(reviews.map((r) => r.creator_id)));
    if (ids.length === 0) return;
    let cancelled = false;
    getUsers({ ids }).then((res) => {
      if (cancelled) return;
      const map: Record<string, Reviewer> = {};
      for (const u of res.data ?? [])
        map[u.id] = { name: u.name, avatar_url: u.avatar_url };
      setReviewers(map);
    });
    return () => {
      cancelled = true;
    };
  }, [reviews]);

  if (reviews.length === 0) {
    return <p className="text-sm text-gray-400 italic">No reviews yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {reviews.map((r) => {
        const who = reviewers[r.creator_id];
        return (
          <li key={r.id} className="flex gap-3 py-3">
            <Avatar name={who?.name ?? null} url={who?.avatar_url ?? null} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {who?.name ?? "User"}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((n) =>
                    n <= r.rating ? (
                      <StarFill key={n} className="text-[#DEA440]" size={12} />
                    ) : (
                      <Star key={n} className="text-gray-200" size={12} />
                    ),
                  )}
                </span>
                <span className="ml-auto text-xs text-gray-400 shrink-0">
                  {timeAgo(r.created_at)}
                </span>
              </div>
              {r.comment && (
                <p className="mt-0.5 text-sm text-gray-600 whitespace-pre-wrap break-words">
                  {r.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts components/reviews-list.tsx
git commit -m "feat(reviews): shared self-contained ReviewsList component"
```

---

### Task 4: Add the reviews section to the own `/profile` page

**Files:**
- Modify: `app/(protected)/profile/page.tsx`

**Interfaces:**
- Consumes: `ReviewsList` (Task 3). The page already calls `getReviews({ rated_user_id: currentUser.id })` in `loadData` (used for the rating average) — capture the raw list into state and render it.

- [ ] **Step 1: Import and add reviews state**

In `app/(protected)/profile/page.tsx`:

Add the import near the other component imports:

```tsx
import ReviewsList from "@/components/reviews-list";
import type { SelectReview } from "@/lib/db/schema";
```

Add state alongside `avgRating`/`reviewCount` (near line 44-46):

```tsx
const [reviews, setReviews] = useState<SelectReview[]>([]);
```

In `loadData`, where `reviewsResult` is handled (near line 133), also store the list:

```tsx
    if (reviewsResult.data && reviewsResult.data.length > 0) {
      const sum = reviewsResult.data.reduce((acc, r) => acc + r.rating, 0);
      setAvgRating(Math.round((sum / reviewsResult.data.length) * 10) / 10);
      setReviewCount(reviewsResult.data.length);
      setReviews(reviewsResult.data);
    }
```

- [ ] **Step 2: Render the section on desktop**

In the desktop layout, immediately after the Current Offers `</section>` (near line 314, before the closing `</div>` of the `hidden md:block` block), add:

```tsx
          {/* Reviews */}
          <section className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reviews</h2>
            <div className="border-t border-gray-200 pt-2 max-w-2xl">
              <ReviewsList reviews={reviews} />
            </div>
          </section>
```

- [ ] **Step 3: Render the section on mobile**

In the mobile layout, immediately after the Current Offers `</section>` (near line 459, before the block's closing `</div>`), add:

```tsx
          {/* Reviews */}
          <section className="mt-4">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Reviews</h2>
            <div className="border-t border-gray-200 pt-2">
              <ReviewsList reviews={reviews} />
            </div>
          </section>
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/profile/page.tsx"
git commit -m "feat(profile): reviews section on own profile (mobile + desktop)"
```

---

### Task 5: Public profile route `/profile/[userId]`

**Files:**
- Create: `app/(protected)/profile/[userId]/page.tsx`

**Interfaces:**
- Consumes: `getPublicProfile` (Task 2), `getReviews` (`@/lib/actions/reviews`), `getOffers` (`@/lib/actions/offers`), `ReviewsList` (Task 3), `useAuth`, `useParams`/`useRouter`.
- Read-only: no edit / logout / avatar upload. Phone + ID render only when the server returns them non-null (i.e. viewer is a counterparty or self).

- [ ] **Step 1: Create the page**

Create `app/(protected)/profile/[userId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { StarFill } from "react-bootstrap-icons";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import ReviewsList from "@/components/reviews-list";
import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getPublicProfile } from "@/lib/actions/users";
import { getReviews } from "@/lib/actions/reviews";
import { getOffers } from "@/lib/actions/offers";
import type { PublicProfile } from "@/lib/services/users.service";
import type { SelectReview, SelectOffer } from "@/lib/db/schema";

export default function PublicProfilePage() {
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<SelectReview[]>([]);
  const [offers, setOffers] = useState<SelectOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Own profile → redirect to the editable page.
  useEffect(() => {
    if (userId && userId === currentUser.id) router.replace("/profile");
  }, [userId, currentUser.id, router]);

  useEffect(() => {
    if (!userId || userId === currentUser.id) return;
    let cancelled = false;
    Promise.all([
      getPublicProfile(userId),
      getReviews({ rated_user_id: userId }),
      getOffers({ user_id: userId, status: "Active" }),
    ]).then(([profileRes, reviewsRes, offersRes]) => {
      if (cancelled) return;
      if (!profileRes.data) {
        setNotFound(true);
      } else {
        setProfile(profileRes.data);
        setReviews(reviewsRes.data ?? []);
        setOffers(offersRes.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser.id]);

  const avg =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10,
        ) / 10
      : 0;

  if (userId === currentUser.id) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <PageShellSkeleton />
        <BottomNav />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-gray-400 text-sm">This user could not be found.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  const name = profile.name || "User";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 px-4 pt-6 pb-28 w-full mx-auto max-w-md md:max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 md:gap-8">
          <div className="relative w-24 h-24 md:w-40 md:h-40 shrink-0 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-medium">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={name} fill className="object-cover" />
            ) : (
              <span className="uppercase">{name.charAt(0)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900">{name}</h1>
              {reviews.length > 0 && (
                <span className="flex items-center gap-1 text-lg font-semibold text-gray-800">
                  {avg}
                  <StarFill className="text-[#DEA440]" size={18} />
                </span>
              )}
            </div>

            {/* Contextual disclosure — only present when server deems the viewer a counterparty */}
            {(profile.phone_number || profile.id_number != null) && (
              <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm">
                {profile.phone_number && <span>{profile.phone_number}</span>}
                {profile.id_number != null && <span>ID: {profile.id_number}</span>}
              </div>
            )}

            {profile.description && (
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                {profile.description}
              </p>
            )}

            <p className="mt-3 inline-block rounded-full bg-[#3761B0] text-white text-sm font-medium px-4 py-1.5">
              {profile.contributions} completed transaction
              {profile.contributions !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Current offers */}
        <section className="mt-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Current Offers</h2>
          <div className="border-t border-gray-200 pt-4">
            {offers.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No active offers</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="shrink-0 w-44 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-bold text-gray-800 uppercase text-sm mb-1 truncate">
                      {offer.title}
                    </p>
                    <p className="text-sm text-gray-500 line-clamp-3">
                      {offer.description ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">Reviews</h2>
          <div className="border-t border-gray-200 pt-2">
            <ReviewsList reviews={reviews} />
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (`PageShellSkeleton` and `BottomNav` already exist and are used elsewhere; import paths mirror `app/(protected)/profile/page.tsx` and `app/(protected)/chat/page.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add "app/(protected)/profile/[userId]/page.tsx"
git commit -m "feat(profile): read-only public /profile/[userId] with contextual disclosure"
```

---

### Task 6: Card poster avatar + profile link (`ItemRequestCard`)

**Files:**
- Modify: `components/ui/item.tsx`

**Interfaces:**
- Produces: new optional props on `ItemRequestCardProps` — `posterId?: string`, `posterName?: string`, `posterAvatarUrl?: string`, `isOwnPoster?: boolean`. Backward compatible: with none supplied the card renders exactly as today.
- The poster line becomes an avatar + the existing `requestedBy` label; when `posterId` is set and `!isOwnPoster`, the label is a `next/link` to `/profile/[posterId]` with `stopPropagation` so it navigates to the profile without triggering the card's `onClick` detail modal.

- [ ] **Step 1: Add imports and props**

In `components/ui/item.tsx`, add at the top:

```tsx
import Link from "next/link";
```

Extend `ItemRequestCardProps` with:

```tsx
  posterId?: string;
  posterName?: string;
  posterAvatarUrl?: string;
  isOwnPoster?: boolean;
```

Add them to the destructured params (with defaults) in the function signature:

```tsx
  posterId,
  posterName,
  posterAvatarUrl,
  isOwnPoster = false,
```

- [ ] **Step 2: Replace the poster text line**

Find the existing poster line (near lines 107-111):

```tsx
        <p className="text-xs text-gray-600 truncate">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
```

Replace it with an avatar + linked label:

```tsx
        <div className="flex items-center gap-1.5 min-w-0">
          {posterName != null && (
            <span className="w-[18px] h-[18px] rounded-full bg-gray-200 overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-semibold text-gray-500 uppercase">
              {posterAvatarUrl ? (
                <Image
                  src={posterAvatarUrl}
                  alt={posterName || "User"}
                  width={18}
                  height={18}
                  className="object-cover w-full h-full"
                />
              ) : (
                (posterName || "U").charAt(0)
              )}
            </span>
          )}
          {posterId && !isOwnPoster ? (
            <Link
              href={`/profile/${posterId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-600 truncate hover:underline"
            >
              {variant === "lent"
                ? requestedBy.replace(/^Offered by:/i, "Lent by:")
                : requestedBy}
            </Link>
          ) : (
            <p className="text-xs text-gray-600 truncate">
              {variant === "lent"
                ? requestedBy.replace(/^Offered by:/i, "Lent by:")
                : requestedBy}
            </p>
          )}
        </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/item.tsx
git commit -m "feat(card): poster avatar + profile link (stopPropagation-guarded)"
```

---

### Task 7: Thread poster data from the feed into cards

**Files:**
- Modify: `app/(protected)/(home)/page.tsx`

**Interfaces:**
- Consumes: the new `ItemRequestCard` props (Task 6). The feed already builds a `usersMap` of poster names; extend it to also carry `avatar_url`, then pass `posterId`/`posterName`/`posterAvatarUrl`/`isOwnPoster` per card.

- [ ] **Step 1: Extend `ListItem` and the users map**

In `app/(protected)/(home)/page.tsx`:

Add fields to the `ListItem` type (near line 34-45):

```tsx
  posterId: string;
  posterName: string;
  posterAvatarUrl?: string;
  isOwnPoster: boolean;
```

Change the users map to carry name + avatar. Replace the map build (near lines 72-77):

```tsx
  const usersMap = new Map<string, { name: string; avatarUrl?: string }>();
  if (userIds.size > 0) {
    const usersResult = await getUsers({ ids: Array.from(userIds) });
    for (const u of usersResult.data ?? [])
      usersMap.set(u.id, {
        name: u.name ?? "User",
        avatarUrl: u.avatar_url ?? undefined,
      });
  }
```

- [ ] **Step 2: Populate the new fields in both mappings**

In the offers loop (near lines 81-102), compute the poster and set fields. Replace the `posterName` line and add the fields to the pushed object:

```tsx
  for (const post of postsResult.data ?? []) {
    const isOwn = post.user_id === userId;
    const entry = usersMap.get(post.user_id ?? "");
    const posterName = isOwn ? (userName ?? "You") : (entry?.name ?? "User");
    mapped.push({
      id: post.id,
      itemDbId: post.id,
      userId: post.user_id ?? "",
      variant: "lent",
      requestedBy: `Offered by: ${posterName}`,
      price: formatIncentive(post.incentive),
      typeBadge: "Offer",
      posterId: post.user_id ?? "",
      posterName,
      posterAvatarUrl: isOwn ? undefined : entry?.avatarUrl,
      isOwnPoster: isOwn,
      detail: {
        title: post.title,
        lentBy: posterName,
        quantity: 1,
        price: formatIncentive(post.incentive),
        description: post.description ?? undefined,
        imageUrl: post.imgUrl ?? undefined,
        posterId: post.user_id ?? undefined,
      },
    });
  }
```

Apply the same pattern to the requests loop (near lines 105-128):

```tsx
  for (const req of requestsResult.data ?? []) {
    const isOwn = req.user_id === userId;
    const entry = usersMap.get(req.user_id ?? "");
    const posterName = isOwn ? (userName ?? "You") : (entry?.name ?? "User");
    mapped.push({
      id: req.id,
      itemDbId: req.id,
      userId: req.user_id ?? "",
      variant: "requested",
      requestedBy: `Requested by: ${posterName}`,
      price: formatIncentive(req.incentive),
      typeBadge: "Request",
      posterId: req.user_id ?? "",
      posterName,
      posterAvatarUrl: isOwn ? undefined : entry?.avatarUrl,
      isOwnPoster: isOwn,
      detail: {
        title: req.title,
        requestedBy: posterName,
        quantity: 1,
        price: formatIncentive(req.incentive),
        description: req.description ?? undefined,
        imageUrl: req.imgUrl ?? undefined,
        urgency: req.urgency ?? undefined,
        posterId: req.user_id ?? undefined,
      },
    });
  }
```

(The `detail.posterId` field is added to `ItemDetailData` in Task 8 — add it here now; TypeScript will accept it once Task 8 lands. If you implement tasks in order, do Task 8's type change first if tsc complains, or add the `posterId?: string` field to `ItemDetailData` as part of this step. To keep this task self-contained, if `ItemDetailData` does not yet have `posterId`, add `posterId?: string;` to the `ItemDetailData` interface in `components/ui/item-detail-modal.tsx` now.)

- [ ] **Step 3: Pass the props to `ItemRequestCard`**

In the JSX map (near lines 297-309), add the four props:

```tsx
                <ItemRequestCard
                  key={item.id}
                  variant={item.variant}
                  requestedBy={item.requestedBy}
                  section={item.section}
                  time={item.time}
                  price={item.price}
                  typeBadge={item.typeBadge}
                  urgency={item.detail.urgency}
                  posterId={item.posterId}
                  posterName={item.posterName}
                  posterAvatarUrl={item.posterAvatarUrl}
                  isOwnPoster={item.isOwnPoster}
                  detail={item.detail}
                  onClick={() => setSelectedItem(item)}
                />
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/(home)/page.tsx" components/ui/item-detail-modal.tsx
git commit -m "feat(feed): thread poster avatar + profile link into cards"
```

---

### Task 8: Profile links in the item-detail modal and chat header

**Files:**
- Modify: `components/ui/item-detail-modal.tsx`
- Modify: `app/(protected)/chat/page.tsx`

**Interfaces:**
- Consumes: `posterId` on `ItemDetailData` (added in Task 7 Step 2; if not present, add `posterId?: string;` to the interface here), `isOwner` prop (already exists), the chat page's `otherId`.
- Produces: the poster's name in the modal links to `/profile/[posterId]` (unless `isOwner`); the chat header avatar + name link to `/profile/[otherId]`.

- [ ] **Step 1: Ensure `posterId` is on `ItemDetailData`**

In `components/ui/item-detail-modal.tsx`, confirm/add to the `ItemDetailData` interface (near lines 8-20):

```tsx
  posterId?: string;
```

- [ ] **Step 2: Link the poster name in the modal**

Add the import at the top of `components/ui/item-detail-modal.tsx`:

```tsx
import Link from "next/link";
```

Replace the `lentBy`/`requestedBy` lines (near lines 120-127):

```tsx
            {item.lentBy && (
              <p className="text-sm text-gray-600">
                Lent by{" "}
                {item.posterId && !isOwner ? (
                  <Link
                    href={`/profile/${item.posterId}`}
                    className="font-medium text-[#3761B0] hover:underline"
                    onClick={onClose}
                  >
                    {item.lentBy}
                  </Link>
                ) : (
                  <span className="font-medium">{item.lentBy}</span>
                )}
              </p>
            )}
            {item.requestedBy && (
              <p className="text-sm text-gray-600">
                Requested by{" "}
                {item.posterId && !isOwner ? (
                  <Link
                    href={`/profile/${item.posterId}`}
                    className="font-medium text-[#3761B0] hover:underline"
                    onClick={onClose}
                  >
                    {item.requestedBy}
                  </Link>
                ) : (
                  <span className="font-medium">{item.requestedBy}</span>
                )}
              </p>
            )}
```

- [ ] **Step 3: Link the chat header to the other user's profile**

In `app/(protected)/chat/page.tsx`, add the import:

```tsx
import Link from "next/link";
```

Wrap the header avatar + name block in a link to the other user's profile. Replace the avatar `<div>` and the name/rating `<div className="flex-1 min-w-0">` region (near lines 110-136) so both sit inside a single `Link` to `/profile/[otherId]`:

```tsx
        <Link
          href={`/profile/${otherId}`}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90"
        >
          <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden shrink-0">
            {otherAvatarUrl ? (
              <Image src={otherAvatarUrl} alt={otherName || "User"} width={36} height={36} className="object-cover w-full h-full" />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-sm font-medium text-gray-500 uppercase">
                {(otherName || "U").charAt(0)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 leading-tight line-clamp-1 text-sm">
                {title}{otherName ? ` | ${otherName}` : ""}
              </p>
              {otherRating != null ? (
                <span className="flex items-center gap-0.5 text-xs font-medium text-gray-600 shrink-0">
                  {otherRating}<StarFill className="text-[#DEA440]" size={12} />
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic shrink-0">No reviews yet</span>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-tight">
              {kind === "offer" ? "Offer" : "Request"}
            </p>
          </div>
        </Link>
```

(This replaces the previous sibling avatar `<div>` and info `<div>`; the back button before it and the "Mark done" button after it are unchanged.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/ui/item-detail-modal.tsx "app/(protected)/chat/page.tsx"
git commit -m "feat(nav): profile links from item-detail modal and chat header"
```

---

### Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the touched-file tests**

Run: `npm test -- __tests__/lib/date.test.ts`
Expected: PASS (7 cases). (`timeAgo` is the only new pure unit; the rest is UI/DB — manual QA.)

- [ ] **Step 2: Lint the touched files**

Run:
```bash
npx eslint lib/date.ts lib/repo/relationships.repo.ts lib/services/users.service.ts lib/actions/users.ts components/reviews-list.tsx components/ui/item.tsx components/ui/item-detail-modal.tsx "app/(protected)/profile/page.tsx" "app/(protected)/profile/[userId]/page.tsx" "app/(protected)/(home)/page.tsx" "app/(protected)/chat/page.tsx" lib/db/schema.ts
```
Expected: 0 errors from these files.

- [ ] **Step 3: Manual QA checklist (after the user runs the pending `avatar_url` push)**

- [ ] Feed card: poster avatar (photo or initial) shows; tapping the **name** opens `/profile/[posterId]`; tapping elsewhere on the card opens the detail modal (stopPropagation works) — verify mobile + widescreen.
- [ ] Detail modal: "Lent by / Requested by" name links to the poster's profile; own items don't link.
- [ ] Chat header: tapping the avatar/name opens the other user's profile.
- [ ] `/profile/[userId]` as a **stranger** (no shared bid): name, rating, bio, contributions, current offers, reviews all show; **phone + ID are absent** (and absent from the network payload, not just hidden).
- [ ] `/profile/[userId]` as a **counterparty** (shared a bid either direction): phone + ID now show.
- [ ] Visiting your own `/profile/[yourId]` redirects to `/profile`.
- [ ] Reviews render on both own `/profile` and public profiles, with reviewer name/avatar/stars and relative dates; empty state reads "No reviews yet."

---

## Notes / non-goals

- **Tracker card profile links are deferred.** The tracker card shows a deal *counterparty* whose label sometimes reads "You", and the tracker fetch is the N+1 hot spot slated for the Epic F batch refactor. Wiring poster links/avatars there belongs with that refactor, not this plan — the feed is the primary discovery surface for profiles.
- **Privacy is enforced server-side** (`getPublicProfile` redacts phone/ID), a deliberate hardening of the spec's "show only if related" so the data never reaches a stranger's client.
- No change to how reviews are created or to review notifications (removing review notifs is Epic E).
- Depends on C3a's `avatar_url` at runtime; code compiles without the push.
