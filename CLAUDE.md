# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run lint       # ESLint
npm test           # Jest (single run)
npm run test:watch # Jest (watch mode)
npm format         # format before push (required)
```

Run single test file: `npm test -- __tests__/actions/posts.test.ts`

## Architecture

**MakeAbot** — campus marketplace for Ateneo students (@student.ateneo.edu only). Students post items/services, bid, chat, and review each other.

### Stack

- Next.js 16 App Router + Turbopack, React 19
- Supabase (Postgres + Auth + Realtime + Storage)
- Drizzle ORM (`lib/db/schema.ts`) — migrations via `drizzle-kit`
- shadcn/ui (New York style, RSC enabled) + Tailwind 4
- TanStack React Query (client state), Zod (validation)
- Resend (email), `web-push` (push notifications)

### Backend layers

```
Server Actions (lib/actions/)
  → Services (lib/services/)     # domain logic, notification triggers
    → Repositories (lib/repo/)   # Drizzle queries
      → DB
```

- `AppError` class for structured errors
- `handleAction()` wrapper for server actions, `handleApiError()` for API routes

### Route groups

- `(auth)` — login, auth error, confirm
- `(protected)` — all authenticated routes
- `(home)` — create-offer, create-request (nested under protected)
- Dead code: `app/auth/login/` — the real login is `app/(auth)/login/`

### Auth

- Supabase Auth + Google OAuth only (OTP/magic link confirm also exists at `app/auth/confirm/route.ts`)
- Server client: `lib/supabase/server.ts`, browser client: `lib/supabase/client.ts`
- `AuthContext` + `useCurrentUser` / `useAuth` hooks for client state

### Notifications system

Three channels: in-app tracker (bell icon), web push (VAPID), email (Resend).

Key files:

- `lib/services/push.service.ts` — `sendPushToUser()` / `sendPushToAllUsers()`; use `Promise.allSettled()`, delete stale 410/404 subs
- `lib/repo/notifications.repo.ts` — CRUD + upsert for `notifications` table
- `public/sw.js` — service worker; handles push events + `notificationclick`
- `hooks/use-push-subscription.ts` — registers SW, prompts contextually (after first bid/message, never on page load)
- `components/notifications-bell.tsx` — unread count badge in nav
- `app/(protected)/notifications/page.tsx` — mobile surface; `components/ui/notifications-panel.tsx` is the desktop drawer. Both filter on All / Messages / Activity (`lib/notifications-filter.ts`) and must stay at feature parity

A thread produces at most one bell row per user: phase 1 writes a `new_inquiry`
row, and when the thread graduates to phase 2 that row is deleted so only the
coalesced `new_message` row remains. All notification dispatch runs through
`runAfterResponse()` (`lib/after-response.ts`) so it survives past the action's
response on serverless.

Message notifications coalesce: upsert on `(user_id, type, context_id)`. Push uses Web Push `Topic: chat_<session_id>` to replace OS notification in-place. Silent push when chat tab is focused (check via `clients.matchAll()`).

**Trigger policy** — which events may interrupt, and how loudly:

| Type                                                   | Channels                                               |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `new_inquiry` (first contact on your post)             | in-app + push + email                                  |
| `new_inquiry` follow-up before you reply               | in-app only                                            |
| `new_message` (coalesced per thread)                   | in-app + push                                          |
| `new_request` / `new_offer` (broadcast)                | see below                                              |
| `request_completed_winner`, `offer_bid_completed`      | in-app + push                                          |
| `request_completed_loser`, `bid_expired`, `new_review` | in-app only (`IN_APP_ONLY_TYPES` in `push.service.ts`) |

Broadcasts are governed by `lib/broadcast-policy.ts` (pure, tested):

- **Urgency gates requests** — Now / Within the hour → push; Within the day → bell row only; Within the week / Indefinite → nothing. Request urgency defaults to "Within the day" so the loud tier is deliberate.
- **Per-poster cooldown** — one broadcast push per hour, spanning requests _and_ offers.
- **Per-recipient cap** — max 5 broadcast pushes per user per 24h. Capped users still get the bell row; `notifications.pushed` records that a push was _attempted_ for that row (not that the endpoint accepted it) and is what the cap counts.
- **Retention** — the `expire-bids` cron prunes broadcast rows older than 14 days. Directed notifications are never pruned.
- Offers have no urgency; the `new_offer` preference defaults to **false** (opt-in).
- In-app broadcast rows honour the per-type preference — don't bypass `findBroadcastRecipients`.

Daily digest is bounded to conversations unread in the last 24h and respects the `email_digest` preference. Emails link to `/settings/notifications`; there is no signed-token one-click unsubscribe yet.

VAPID is initialised lazily (`ensureVapid()`) — missing keys disable push, they must not take down `messages.service`, which imports this module.

PWA manifest lives at `app/manifest.ts`. It is required for iOS: without Add to Home Screen, iOS Safari has no Web Push at all.

### Real-time chat

Supabase Realtime subscriptions in `components/realtime-chat.tsx`. Messages tied to bid → post/request relationship.

### Cron jobs

Both auth via `CRON_SECRET` Bearer token, scheduled in `vercel.json`:

- `/api/cron/daily-digest` (00:00) — unread-conversation email summary
- `/api/cron/expire-bids` (00:05) — expires 14-day-stale bids, fires `bid_expired`, prunes stale broadcast notifications

## Critical security issues (unresolved)

- **No auth checks in any Server Action** (`lib/actions/*.ts`) — all mutations publicly accessible
- **Middleware broken**: `proxy.ts` doesn't guard routes; `lib/middleware.ts` has real logic but is dead code
- **Email domain restriction missing** from OTP confirm flow (`app/auth/confirm/route.ts`)
- **N+1 query waterfalls** on every data-loading page

Fix auth before adding features.

## Git workflow

Branch: `feature/name` → `dev` → PR → `prod` (Niles handles prod merges).

```bash
git checkout dev && git pull origin dev
git checkout -b feature/your-feature-name
# ... work ...
npm format && git push -u origin feature/your-feature-name
# open PR into dev
```

Worktrees for parallel work live in `.worktrees/`.

## Key env vars

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_SUPABASE_SERVICE_ROLE_KEY
PUBLIC_VAPID_KEY / PRIVATE_VAPID_KEY / VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY
RESEND_API_KEY / RESEND_FROM
NEXT_PUBLIC_SITE_URL
CRON_SECRET
```

VAPID keys must never be rotated — invalidates all stored push subscriptions.
