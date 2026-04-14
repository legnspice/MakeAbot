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
- `app/(protected)/notifications/page.tsx` — grouped: Messages / Bids & Reviews / Opportunities

Message notifications coalesce: upsert on `(user_id, type, context_id)`. Push uses Web Push `Topic: chat_<session_id>` to replace OS notification in-place. Silent push when chat tab is focused (check via `clients.matchAll()`).

Broadcast (`new_request`): push-only, no in-app row (avoids flooding history). Cooldown check: `created_at > now() - interval '1 minute'`.

### Real-time chat
Supabase Realtime subscriptions in `components/realtime-chat.tsx`. Messages tied to bid → post/request relationship.

### Cron jobs
`/api/cron/daily-digest` — auth via `CRON_SECRET` Bearer token. Scheduled in `vercel.json`.

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
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
RESEND_API_KEY / RESEND_FROM
NEXT_PUBLIC_SITE_URL
CRON_SECRET
```

VAPID keys must never be rotated — invalidates all stored push subscriptions.
