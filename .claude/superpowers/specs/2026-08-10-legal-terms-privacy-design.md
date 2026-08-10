# Legal — Terms of Use & Data Privacy Policy — Design Spec

**Date:** 2026-08-10
**Epic:** Legal (deferred from Epic D)
**Branch:** `feature/qa-fixes-v2` (off `dev`)
**Status:** Approved design, pending implementation plan

## Goal

Add a formal **Terms of Use** and **Data Privacy Policy** to MakeAbot as public pages, and fold agreement to them into the existing one-time acknowledgment modal — closing the legal gap ARSA raised. (The short liability *disclaimer* — modal + footer — already exists; this adds the formal documents.)

**Caveat (carried for the user, not printed on the pages):** these are reasonable, MakeAbot-specific student-project drafts grounded in the app's real data practices and the PH Data Privacy Act (RA 10173) — **not legal advice**. Review (ideally by someone qualified) before public launch, alongside the domain-gate launch blocker (see `memory/project_launch_blockers.md`).

## Key facts (verified in code)

- No `/terms` or `/privacy` routes exist; no `docs/legal`.
- `components/disclaimer-modal.tsx` — one-time modal gated on `localStorage` key `disclaimer_accepted_v1`, shows the liability disclaimer, single "I understand, continue" button, rendered in the protected layout.
- `components/app-footer.tsx` — has the short liability text + Facebook/email contacts; **no** links to legal pages.
- Real data model the Privacy Policy must reflect: `users` (name, id_number, phone_number, description, avatar_url), Google OAuth metadata (email, name, avatar), `offers`/`requests`/`offer_bids`/`request_bids`, `messages`, `reviews`, `reports`, `push_subscriptions`, `notifications`, `notification_preferences`. Processors: Supabase (Postgres/Auth/Storage), Google (OAuth), Resend (email), Web Push (VAPID). Contextual disclosure: phone/ID shown only to counterparties (relationshipExists); reports admin-only; no data selling.
- Incentive cap: ₱500 (`lib/constants.ts` PRICE_CAP), enforced on offers/requests.

## Design

### 1. Public legal pages
- `app/terms/page.tsx` and `app/privacy/page.tsx` — **top-level routes** (outside `(protected)`) so they're reachable pre-auth (linked from login) and by anyone.
- Shared presentational `components/legal-layout.tsx` — `LegalLayout({ title, lastUpdated, children })`: logo, a "← Back" link (`router.back()` or link to `/`), a centered readable prose container (max-width, headings/paragraph styling, responsive), and the "Last updated" line. No new dependency — content authored as semantic TSX (`<section><h2>…</h2><p>…</p></section>`), not markdown.
- Both pages are static (no data fetching), theme-consistent with the app.

### 2. Terms of Use content (`app/terms/page.tsx`)
Sections, MakeAbot-specific:
1. About MakeAbot — independent, student-led; **not affiliated with/endorsed by Ateneo**; a coordination platform only, with no oversight of actual transactions.
2. Eligibility — intended for Ateneo students (note: the `@student.ateneo.edu` restriction is a launch requirement; see launch-blocker).
3. Your account — Google sign-in; keep info accurate; you're responsible for activity.
4. Posting offers & requests — accurate listings; the **₱500 incentive cap**; no prohibited items/services.
5. Bidding, chat & completing deals — how deals form; marking done; arranging exchanges off-platform is at users' own arrangement.
6. Reviews & reporting — reviews tied to completed deals; the report/moderation process; no review/report weaponization.
7. Prohibited conduct — harassment, scams, illegal items, spam, impersonation, misuse.
8. Disclaimers & limitation of liability — folds in the existing liability language (at-your-own-risk; creators not liable for disputes/losses/damage).
9. Suspension & termination — accounts violating the terms may be suspended/removed.
10. Changes to these terms — may update; continued use = acceptance.
11. Governing law — Philippines.
12. Contact — Facebook + email.

### 3. Data Privacy Policy content (`app/privacy/page.tsx`)
Sections, grounded in the real data model + DPA:
1. Who we are & scope.
2. Information we collect — from Google (email, name, profile photo); profile you provide (phone number, ID number, bio); content you create (posts, chats/messages, reviews, reports); technical (push subscription tokens, notification records).
3. How we use it — run the platform, connect counterparties, notifications (in-app/push/email), safety/moderation.
4. Legal basis — your consent (given via the acknowledgment gate) and legitimate operation of the service under the DPA.
5. How we share it — **contextual disclosure**: your phone number/ID are shown only to users you've actually dealt with (a shared bid); reports are visible only to admins; **we do not sell your data**.
6. Service providers (processors) — Supabase (database/auth/storage), Google (sign-in), Resend (email), Web Push (VAPID). Data may be processed on their infrastructure.
7. Retention — kept while your account is active; deleted/anonymized on account deletion (best-effort for a student project).
8. Your rights (DPA data-subject rights) — access, correction, erasure/blocking, objection; how to exercise (contact us).
9. Security — Supabase-managed auth, access controls; caveat that no system is perfectly secure.
10. Cookies & local storage — session cookies for auth; `localStorage` for the acknowledgment and tutorial flags (no third-party ad tracking).
11. Children/age — intended for Ateneo university students.
12. Changes to this policy.
13. Contact & complaints — our contact + reference to the National Privacy Commission (NPC).

### 4. Consent + wiring
- **`components/disclaimer-modal.tsx`**: keep the two liability paragraphs; add a line — "By continuing, you agree to our **Terms of Use** and **Data Privacy Policy**." — with both as `next/link`s to `/terms` and `/privacy` using `target="_blank" rel="noopener noreferrer"` (so opening them doesn't dismiss the gate). Change the button label to "I agree and continue". Bump the storage key `disclaimer_accepted_v1` → `disclaimer_accepted_v2` so existing users re-acknowledge once (now that it includes agreement to the documents).
- **`components/app-footer.tsx`**: add "Terms of Use" (`/terms`) and "Privacy Policy" (`/privacy`) links (a small legal-links row alongside the contacts).
- **Login page** (`app/(auth)/login/page.tsx`): add small "Terms of Use" + "Privacy Policy" links near the sign-in button.

## Non-goals / out of scope
- Server-side consent records (a `consented_at` column / audit trail) — localStorage acknowledgment is retained; server-side consent noted as a future hardening.
- Cookie-consent banner, versioned re-acceptance beyond the single key bump, multi-language.
- No change to the actual data practices — the policy *documents* current behavior; it doesn't alter collection/sharing.

## Testing
- Mostly content + static pages — verified by build + manual QA. No pure logic units introduced (the modal key-bump and links are UI).
- **Manual QA:** `/terms` and `/privacy` render and are reachable while logged OUT (from login links) and logged in (footer); the acknowledgment modal re-appears once for existing users (v2 key), its Terms/Privacy links open in a new tab without dismissing the modal, and "I agree and continue" persists acceptance; footer + login links resolve; responsive at mobile + widescreen.

## Risks & verification
- **Reachability pre-auth:** confirm `/terms` and `/privacy` are NOT under `(protected)` and don't require a session (linked from login).
- **Modal key bump** re-prompts every existing user once — intended; verify it doesn't loop.
- **Content accuracy:** the Privacy Policy must match actual behavior (contextual disclosure, no selling, the named processors) — cross-check against the schema/services so it isn't misleading.
- **New-tab links from the modal** must not close the gate (localStorage only set on the button).
