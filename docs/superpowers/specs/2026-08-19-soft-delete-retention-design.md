# Soft Delete & Retention — Design (Spec B)

> Captured 2026-08-19. Companion to
> `2026-08-15-close-model-redesign-design.md`, which deliberately deferred this
> and named it "Spec B". That close model is shipped; this spec addresses what
> Delete does.

---

## Problem

`Close` preserves. `Delete` destroys — and it destroys more than the person
pressing it owns.

The cascade, verified in `lib/db/schema.ts`:

```
DELETE requests / offers
  └─ request_bids / offer_bids     ON DELETE CASCADE
       ├─ messages                 ON DELETE CASCADE
       └─ reviews                  ON DELETE CASCADE

reports.reported_request_id / reported_offer_id   ON DELETE SET NULL
```

Three consequences:

**1. Delete is a reputation eraser.** A user who received a 1-star review on
their own listing can delete the listing and the review row cascades away. Their
average silently recalculates upward and nothing records that it happened.

**2. Deleting damages the counterparty's record.** The same cascade destroys the
review the deleter *wrote about someone else* — that person's earned reputation,
on a listing they do not control, with no notice and no recourse.

**3. Reports outlive their evidence.** `reported_request_id` is `SET NULL`, so a
scam report survives as a row pointing at nothing: no listing, no chat log. A
reported user can delete the evidence *after* being reported.

The sharpest form of (1) and (2) is bid-level and still live:
`removeOfferBid` / `removeRequestBid` have no status check, so a bidder can
hard-delete their own **Completed** bid and cascade away the review on it. The
close-model work blocked *withdrawing* a completed bid while *deleting* it
stayed open — the stronger mutation.

Separately, the close-model redesign repointed the tracker's owned-request button
from delete to close, so **Delete currently has no entry point on the request
card at all.** This spec re-sites it.

## Decisions

**D1 — Soft-delete everything, then anonymize on a timer.** Soft-delete for
observability was chosen directly. Unbounded retention, though, does not square
with `app/privacy/page.tsx`:

> §6 Data Retention — "we delete or anonymize your personal data on a
> **best-effort basis**, except where we are required to retain it."
>
> §7 Your Rights — "the right to access, correct, and request **deletion or
> blocking** of your personal data".

Blocking is a distinct right the policy already names, so hiding immediately is a
promise kept. But deletion-or-anonymization is also promised, so the content
cannot simply live forever. The resolution:

```
DELETE pressed
   |
   +-- deleted_at = now() on the listing, its bids, and its messages
   |   invisible to: feed, tracker, profile, chat, search
   |   visible to:   moderation only
   |
   +-- after 30 days, the expire-bids cron ANONYMIZES:
         messages         HARD DELETED
         listing text     title -> "[deleted]", description/incentive/imgUrl -> NULL
         storage object   deleted from the post_photos bucket
         bids             retained as tombstones (see D2)
         reviews          never touched
       SKIPPED while an open report references the listing
```

`title` is `NOT NULL`, so it takes a constant rather than a null.

**D2 — The purge may not hard-delete bids, and that is load-bearing.** `reviews`
cascades on bid deletion. Hard-deleting a tombstoned bid at purge time would
destroy exactly the reviews this spec exists to protect. Bids therefore persist
indefinitely as `(id, parent_id, bidder_id, status, created_at, deleted_at)` — a
few dozen bytes each, and the anchor every review hangs from. Reviews then
survive by construction rather than by a rule someone has to remember.

**D3 — Bid deletion becomes a soft delete.** `removeOfferBid` /
`removeRequestBid` set `deleted_at` instead of deleting. This closes the
review-erasure hole without needing a status guard: there is no longer any path
from a user action to a hard `DELETE` on a row that carries reviews.

**D4 — The purge folds into `expire-bids`, not a new cron.** `vercel.json`
declares exactly two crons, which is the Vercel Hobby ceiling. `expire-bids` is
already the retention job — it prunes stale broadcast notifications — so the
anonymize sweep becomes a fourth step in it. **Confirm the plan tier before
relying on this**; on Pro a dedicated cron would be cleaner and easier to reason
about in isolation.

**D5 — Delete and Close stay distinct, and Delete returns to the UI.** Close
preserves. Delete hides now and anonymizes later. Delete is re-sited on the
owned-listing card as a secondary, clearly destructive action, with copy stating
that the listing and its messages will be removed and that reviews will remain.

## The real risk: read paths

Not the schema — the reads. A single missed filter leaks deleted content into a
feed or a public profile.

The surface is bounded, and smaller than first estimated: **23 query sites across
4 repo files** touch the soft-deletable tables — `messages.repo.ts`,
`offers.repo.ts`, `requests.repo.ts`, `relationships.repo.ts`. The other four
repo files (`notifications`, `reports`, `reviews`, `users`) do not.

Two rules keep this honest:

- Filtering is applied in the **repo layer only**. Services and actions must
  never be responsible for remembering it.
- A test enumerates the exported read functions of those four files and asserts
  each one's generated SQL carries a `deleted_at is null` predicate. A
  hand-maintained list will drift; a test that derives the list from the module's
  own exports will not. This is the one repo-level test this spec asks for, and
  this is why: hand review does not scale to 23 sites and will not catch the
  24th when someone adds it.

Moderation reads need the opposite. Rather than threading an `includeDeleted`
flag through every function — which is how a leak gets introduced — admin
surfaces get their own narrow repo functions that explicitly select tombstones.

## Migration

This spec **requires DDL**, unlike the close-model work: `deleted_at timestamp`
(nullable, no default) on `requests`, `offers`, `request_bids`, `offer_bids`,
`messages`, plus `anonymized_at timestamp` (nullable, no default) on
`requests` and `offers`. Seven columns, all additive, no backfill — every
existing row is correctly `NULL`. `anonymized_at` exists because the sweep's
original "already anonymized" check compared `title` against a fixed
placeholder string, which a user could set on their own listing to escape the
sweep forever; a real column that only the sweep ever writes closes that
hole.

Per project convention this runs as `pnpm drizzle-kit push`, never
`generate`/`migrate`. **Niles runs it**, for the same reason as the close-model
`$onUpdate` change: `push` reconciles the entire schema against the live database
and applies any unrelated accumulated drift it finds, which is not a side effect
to trigger unattended.

No FK changes. The existing `ON DELETE CASCADE` rules stay — they are what makes
the message purge clean, and D2 keeps them away from reviews.

## Storage

`imgUrl` points at an object in the `post_photos` bucket. Uploads happen
client-side (`create-offer/page.tsx`, `create-request/page.tsx`) and there is no
server-side delete helper today — which is why the close-model work found
`closeOffer` nulling `imgUrl` and orphaning the object behind it.

The purge needs one: a small helper over the service-role client that already
exists at `lib/supabase/admin.ts`, deriving the object path from the stored URL.
A failed storage delete must not fail the sweep — log and continue, the way the
broadcast prune already does.

## Reports

The purge must skip any listing an open report references. `reports.repo.ts` has
no such query yet; it needs one — open reports (`status = 'open'`) whose
`reported_request_id` / `reported_offer_id` falls in a given set of ids. Batched
against the sweep's candidate list, not queried per listing.

## Retention window: 30 days (decided)

Confirmed 2026-08-19. Long enough to cover the dispute window where chat logs
actually matter, short enough to be a defensible reading of best-effort deletion.

The alternative considered and rejected was a window of `0` — anonymize
immediately, retain only tombstones and reviews. That is strictly safer on
privacy and simpler to implement, but it discards the observability that
motivated soft-delete in the first place. Worth revisiting if moderation turns
out never to read the retained window in practice; the window is a single
constant, so changing it later is a one-line change.

## Out of scope

- **Account deletion.** `users.id` references `auth.users` with cascade; deleting
  an account is a Supabase-level concern with its own policy language.
- **`deleteReview`** — a user removing their own review is a legitimate, separate
  action, and reviews are not soft-deletable under this spec.
- **`deleteMessage`** — single-message deletion by its sender. Should become a
  soft delete for consistency, but it is not part of the cascade problem.
- **The moderation UI** that would read tombstones. This spec provides the data
  and the narrow repo functions to reach it; the surface itself is separate work.
