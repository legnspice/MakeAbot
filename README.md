# MakeAbot

**MakeAbot** is a hyperlocal coordination platform built exclusively for Ateneo de Manila University students. It reduces the social friction of asking for help on campus — whether that's borrowing a charger, finding someone to print something, or offering a small service to fellow students.

---

## Background

Within the Ateneo community, students frequently face small but urgent needs: borrowing everyday items, requesting quick favors, or finding someone nearby who can help right now. The existing options — group chats, direct messages, Facebook pages — are broadcast tools, not coordination tools. Requests get buried, responses are slow, and the social cost of asking repeatedly is high enough that students often just give up.

MakeAbot is built around a simple idea: **people are generally willing to help — the problem is coordination.** The platform acts as a structured, low-friction medium for students to post what they need, respond to what others need, and track the whole exchange from request to resolution.

Access is restricted to verified Ateneo student accounts (`@student.ateneo.edu`) via Google OAuth, which means every user on the platform is a member of the same campus community. This shared context is the foundation of the trust model.

---

## Features

### Requests & Offers
Students can post **requests** (something they need) or **offers** (something they're providing). Both support images, pricing/fees, urgency levels, and categorization by type. A live feed on the home page shows all active posts from the community, filterable by type, price, and date.

### Bidding System
Rather than direct transactions, MakeAbot uses a **bid-based model**. A student who wants to respond to a request or accept an offer submits a bid. The poster reviews incoming bids and accepts one, at which point a private chat session opens between the two parties. Bids that go stale are automatically expired after two weeks via a scheduled cron job.

### Real-Time Chat
Each accepted bid opens a **private chat session** powered by Supabase Realtime. Messages are tied to the specific request/offer relationship, keeping conversations contextual and organized. The chat interface supports scroll management and live message delivery without polling.

### Deal Completion & Reviews
Once a transaction is complete, either party can mark the deal as done. This triggers a **review prompt** where users rate each other (1–5 stars with an optional comment). Ratings are visible on user profiles and contribute to a student's reputation on the platform.

### Notifications
MakeAbot supports three notification channels:

- **In-app** — a bell icon in the nav with unread count, grouping notifications by category (Messages / Bids & Reviews / Opportunities).
- **Web Push** — browser push notifications via VAPID, delivered even when the app isn't open. Chat notifications use the Web Push `Topic` header to replace OS-level notifications in place (no stacking). Silent push is sent when the chat tab is already focused.
- **Email digest** — a daily summary email sent via Resend, scheduled as a Vercel cron job.

Notifications are coalesced by `(user_id, type, context_id)` to avoid flooding. Users can configure per-channel preferences from the settings page.

### User Profiles
Each student has a profile showing their name, avatar, bio, contact info, contribution history, and aggregated ratings. Avatars are cropped and uploaded via Supabase Storage.

### Onboarding
First-time users are walked through the platform via a **tutorial modal**. A **disclaimer modal** surfaces the platform's usage terms and must be accepted before accessing protected routes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| Auth | Supabase Auth (Google OAuth, Ateneo email only) |
| Real-time | Supabase Realtime |
| UI | shadcn/ui (New York style, RSC enabled) + Tailwind CSS 4 |
| Client state | TanStack React Query |
| Validation | Zod |
| Email | Resend |
| Push notifications | Web Push API (VAPID) |
| Deployment | Vercel (includes cron scheduling) |

---

## Architecture

The backend is organized into three layers below the Next.js Server Actions entry point:

```
Server Actions  (lib/actions/)
  └─ Services   (lib/services/)    — domain logic, notification triggers
       └─ Repositories  (lib/repo/)    — Drizzle ORM queries
            └─ Database  (Supabase Postgres)
```

All server actions use a `handleAction()` wrapper that converts thrown `AppError` instances into structured responses. API routes use a parallel `handleApiError()` wrapper. This keeps error handling consistent across the application without leaking stack traces to the client.

### Route Groups

- `(auth)` — login, auth error, OTP confirm
- `(protected)` — all authenticated routes (home feed, chat, tracker, profile, notifications, settings)
- `(home)` — create-request and create-offer flows, nested inside protected

### Database Schema

| Table | Purpose |
|---|---|
| `users` | Student profiles (name, ID number, phone, bio, contributions) |
| `requests` | Requests posted by students (title, description, fee, urgency, type, status, image) |
| `offers` | Offers posted by students (title, description, price, type, status, image) |
| `request_bids` | Bids submitted on a request (bidder, status: Pending / Accepted / Closed) |
| `offer_bids` | Bids submitted on an offer (bidder, status: Pending / Accepted / Closed) |
| `messages` | Private messages tied to a bid relationship |
| `reviews` | Ratings and comments between users after a deal |
| `notifications` | In-app notification rows (coalesced, with unread state and message count) |
| `notification_preferences` | Per-user toggles for each notification type |
| `push_subscriptions` | VAPID push subscription endpoints per user |

Migrations are managed with `drizzle-kit`. Schema lives in [lib/db/schema.ts](lib/db/schema.ts).

---

## Local Development

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Jest (single run)
npm run test:watch # Jest (watch mode)
npm format         # Prettier (run before pushing)
```

### Environment Variables

The following variables are required. Contact **Niles Cabrera** (`@legnspice`) for access to the credentials.

```
DATABASE_URL

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_SUPABASE_SERVICE_ROLE_KEY

VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT

RESEND_API_KEY
RESEND_FROM

NEXT_PUBLIC_SITE_URL
CRON_SECRET
```

> **Note:** VAPID keys must never be rotated — doing so invalidates all stored push subscriptions for every user.

---

## Git Workflow

```bash
git checkout dev && git pull origin dev
git checkout -b feature/your-feature-name
# ... work ...
npm format && git push -u origin feature/your-feature-name
# open PR into dev
```

Branch flow: `feature/*` → `dev` → PR → `prod` (prod merges handled by Niles).

Worktrees for parallel feature work live in `.worktrees/`.
