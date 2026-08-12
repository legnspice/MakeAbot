# Epic E — Notifications Correctness — Design Spec

**Date:** 2026-08-06
**Epic:** E (notifications)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Three corrections to the notifications system: (1) remove review notifications entirely, (2) fix the cramped mobile filter UX by unifying the panel and page on a scrollable chip filter, (3) harden the notification emails (escape interpolation, fix the broken logo).

Source: QA backlog Epic E + product decision "no more review notifications at all." Scope confirmed 2026-08-06.

## Design

### 1. Remove review notifications (all surfaces)
Delete every `new_review` path:
- **Send:** remove the `sendPushToUser(data.rated_user_id, "new_review", {...})` block in `lib/services/reviews.service.ts:12` (createReview no longer notifies).
- **Preference:** drop `new_review` from `notification_preferences` — `lib/db/schema.ts:178` (the column) **and** the default-preferences insert if it names columns. Requires a `drizzle-kit push` (column drop).
- **Validation:** remove `"new_review"` from the notification-type enum and the `new_review` field in the preferences schema — `lib/validation/notifications.ts:6,37`.
- **Notifications page:** remove the `{ label: "Reviews", types: ["new_review"] }` group — `app/(protected)/notifications/page.tsx:29`.
- **Panel:** remove `new_review` from `CATEGORY_MAP` — `components/ui/notifications-panel.tsx:32`.
- **Settings:** remove the `new_review: "New reviews"` toggle — `app/(protected)/settings/notifications/page.tsx:19`.
- Any already-stored `new_review` rows are harmless (they just won't match a category/group) but the push path is gone.

### 2. Mobile filter — unify on a scrollable chip filter
The panel currently uses 3 equal-width tabs (cramp <~360px); the page uses stacked groups. Unify both on a **shared horizontally-scrollable chip filter** (the feed's pill idiom — chips size to content and scroll, so they never cram). `FilterBar` itself is feed-coupled (search/sort), so build a small dedicated component rather than reuse it.

- New `components/ui/notification-filter.tsx` — `NotificationFilter({ active, onChange })` renders a horizontally-scrollable row of pills for `All | Messages | Activity` (styled like the feed chips: active = filled `#3761B0`, inactive = gray; `overflow-x-auto`, `whitespace-nowrap`, hidden scrollbar).
- **Panel** (`notifications-panel.tsx`): replace the equal-width `TABS` row with `<NotificationFilter>`; keep the existing `filterByTab` logic (`All`/`Messages`/`Activity`). Also make the panel width responsive: `w-full sm:w-100` (or `w-[min(100vw,25rem)]`) so it stops overflowing narrow phones.
- **Page** (`notifications/page.tsx`): replace the stacked `GROUPS` sections with the same `<NotificationFilter>` + a flat, newest-first filtered list (mirrors the panel's model). Category mapping: `Messages` = `new_inquiry`/`new_message`; `Activity` = everything else (`new_request`, …). This also removes the now-defunct "Reviews" group naturally.
- Result: identical filter UX on both surfaces, no cramping, consistent with the feed.

### 3. Email hardening
`lib/services/email.service.ts`:
- **Escape interpolation (correctness + injection):** add a pure `escapeHtml(s: string): string` (`& < > " '`), and wrap every value interpolated into HTML — `title`, `subject`, `body`, and per-row `r.title`/`r.body` — in both `buildEmailHtml` and `sendDailyDigest`. Plain-text (`text:`) parts stay unescaped (correct for text/plain).
- **Logo fix:** the `<img src="${NEXT_PUBLIC_SITE_URL}/icons/icon-192x192.png">` renders as `undefined/icons/...` when `NEXT_PUBLIC_SITE_URL` is unset in the send-time (server/cron) environment. Introduce a single `siteBaseUrl()` helper that returns `process.env.NEXT_PUBLIC_SITE_URL` or a hardcoded production fallback (never `undefined`/empty), and use it for the logo `src` and every URL build in the file. **Deploy note (cannot fix from code):** `NEXT_PUBLIC_SITE_URL` must be set in the Vercel/prod env — call this out in the plan; the fallback prevents a broken `src` regardless.

## Testing
- **Unit (pure, TDD):** `escapeHtml` — escapes `& < > " '`, leaves plain text untouched, handles empty string. `siteBaseUrl` — returns the env value when set, the fallback when unset/empty (test via a small injectable form or by asserting it never yields a string starting with `undefined`).
- **Manual QA:** no review push fires on a new review; notifications page + panel filter by chip with no cramping at 320/360/768/desktop; a message/title containing `<`, `&`, `"` renders correctly in a test email; the logo loads (or degrades to alt text) with the env var unset.

## Risks & verification
- **Schema push (`new_review` column drop):** bundle with Epic D's push; verify the default-preferences insert and any preference read no longer reference `new_review` before/after the drop (drop a column that code still writes → runtime error).
- **Panel/page parity:** the flat filtered list must show the same notifications the grouped view did (minus reviews); verify counts.
- **Email escaping:** ensure double-escaping doesn't occur (escape once, at interpolation).

## Non-goals
- No change to message coalescing, push topics, or the digest's *scope* (still unread messages — broadening it was declined).
- No new notification types.
