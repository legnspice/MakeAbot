# Close Model Redesign — Design

> Captured 2026-08-15. Supersedes decision **D1** in
> `2026-08-15-closing-system-remediation-design.md` (see "What this reverses").
> Answers Open Question #1 and #3 from `request-offer-lifecycle-rework-notes.md`
> (2026-04-08), both of which had been left unresolved since April.
>
> Companion spec: soft-delete and retention are deliberately NOT here. See
> "Deliberately deferred to Spec B".

---

## The problem

Offers and requests were built with different lifecycle models, and only one of
them is complete.

An **offer** is a standing shop. It survives individual transactions, closes per
thread, and shuts as a listing only when the owner is done selling. It has both
levels today: `completeOfferBid` ends one transaction, `closeOffer` ends the
listing.

A **request** is a single need. It is met once, or not at all. It has only one
level: `completeRequest(requestId, winningBidId)`, which *requires* naming a
winner.

There is no request equivalent of `closeOffer`, and the consequence is a live
defect, not merely a missing convenience. Tracing every writer of
`requests.status`: the only path out of `Active` is `completeRequestAtomic`,
which needs a winning bid. The `expire-bids` cron closes stale *bids* and never
touches the parent. So a request nobody answered stays in the feed forever, and
the poster's only exits are:

- **Delete** — destroys the row, cascading to bids, messages, and reviews
- **Fake-complete** — name an arbitrary bidder as winner, firing them a "your
  offer was accepted!" push and opening a review prompt for a transaction that
  never happened

Both are worse than the thing the user wanted, which was to close it.

The enum already anticipated this. `requestStatusEnum` declares `Cancelled` and
nothing has ever written it. (`Ongoing` and the offer-side `Busy` are likewise
declared and unused; this spec does not address them.)

## What this reverses

The remediation spec's **D1** ruled that a losing bidder gets no review prompt,
on the reasoning that a review records a transaction and a loser had none. That
was correct under a model where completion names one winner.

This spec removes winner selection entirely, so "loser" ceases to exist as a
state. Every bidder who actually conversed converts on close, and reviews follow.
**D1 is void.** Its replacement is the single rule in the next section.

Planned Task 9 of the remediation plan survives: its mechanism was "review
eligibility keys off `bidStatus === "Completed"` rather than `parentStatus`",
which remains exactly right. Only *which* bids reach `Completed` changes, plus
the banner copy.

---

## The unifying rule

> **A bid is reviewable, in both directions, if and only if its status is
> `Completed`.**

No new column, no eligibility flag. `Completed` *means* "a transaction happened
here". Everything below is only deciding which bids earn it.

This rule already matches the schema: `reviews` keys on `(creator_id, bid_id)`
with a unique partial index per creator per bid, and `chat-room.tsx` opens the
modal for whoever is *viewing*. Mutual review therefore already works — two rows,
one per direction. Nothing about the review system itself changes.

---

## Requests — one button

`[Close request]` appears on the owned request card in the tracker and in the
chat header. Both invoke the same action. There is no per-thread completion for
requests any more.

At close, each bid resolves by its own state:

| Bid at close | Becomes | Reviewable | Notified |
|---|---|---|---|
| `Pending`, ≥1 message on the thread | `Completed` | yes, both ways | yes |
| `Pending`, zero messages | `Closed` | no | no |
| already withdrawn (`Closed`) | stays `Closed` | no | no |

**One message from either party is enough** — the thread does not need a reply.
This is deliberate. A bidder who messaged and was ignored has the single most
useful thing to report about that requester, and silencing them would let an
unresponsive poster avoid every review by never answering. The test is "was this
thread ever spoken into", not "did both people engage".

The request itself becomes `Completed` if at least one bid completed, and
`Cancelled` if none did. A request with no bids at all therefore closes as
`Cancelled`, so the data never claims a need was met when nobody answered.

Chats become read-only on both sides. All history is preserved — closing sets
statuses and touches nothing else.

### Closing from a chat closes everything

The chat-header button is the same action, not a per-thread one. A requester
sitting in Juan's chat who taps `[Close request]` also ends Maria's and Pedro's
threads. That is surprising enough to require explicit confirmation naming the
blast radius — "Close this request? All 3 inquiries will be closed, and everyone
you've spoken with can leave a review." — rather than a generic "are you sure".

The requester is then prompted once per completed thread, as they open each one.
Three conversing bidders means three review prompts for the requester, not one.
That is correct under the mutual-review model but should not surprise anyone
reading this later.

### Why the zero-message filter

Requiring a real conversation is what keeps "everyone reviews" from being
farmable. Without it, bulk-clicking Inquire on every request in the feed accrues
review rights against every poster. With it, reputation still costs a
conversation.

It also falls out of the same rule rather than bolting onto it: a silent bid
simply never earns `Completed`, so it is not reviewable for the same reason a
withdrawn bid is not.

### Why one button rather than two

The alternative kept a per-thread "Mark done" (naming a helper, mutual review
with them) alongside a separate "Close request" (`Cancelled`, no reviews). That
is more precise about who actually transacted, and it was the option this design
started from.

It was rejected because it asks the requester to make a distinction they often
cannot make honestly. Campus exchanges are frequently diffuse — three people gave
advice, one lent the calculator, a fourth offered and was declined politely. The
two-button model forces exactly one of them to be "the helper" and the rest to be
non-events. The one-button model records what actually happened: these are the
people I dealt with, and we can rate each other.

The cost is accepted and stated: reputation under this model reflects
*interactions*, not deliveries. A user with many reviews has talked to many
people, which is not the same as having delivered many times. This is a
deliberate trade for review volume in a marketplace that has none yet.

---

## Offers — three actions

| Action | Where | Effect | Reviewable |
|---|---|---|---|
| `[Close offer]` | owned offer card | offer → `Closed`; all `Pending` bids → `Closed` | no |
| `[Close transaction]` | per inquiry, owner | that bid → `Completed`; **offer stays `Active`** | yes, both ways |
| `[Dismiss]` | per inquiry, owner | that bid → `Closed` | no |

The first two exist. `[Close transaction]` is today's `completeOfferBid`,
currently labelled "Mark done" — this is a rename, not new behaviour, and the
existing rule that it leaves the parent offer untouched is correct and preserved.

`[Dismiss]` is new. It closes the symmetric gap: a bidder can withdraw their own
inquiry, but the owner has no way to clear a single dead one without shutting the
whole shop.

Bids already `Completed` from earlier transactions are untouched by
`[Close offer]`, and their reviews remain valid. An offer that closes after five
completed transactions keeps all five.

---

## Notifications

Retire `request_completed_winner` and `request_completed_loser`. Add three types:

| Type | Fires when | Channels |
|---|---|---|
| `request_closed` | your bid completed on a closing request | in-app + push |
| `offer_bid_dismissed` | the owner dismissed your inquiry | in-app only |
| `offer_closed` | the offer you had a pending inquiry on shut | in-app only |

`request_closed` carries one message for everyone — "Request closed — leave a
review." Nobody is told they lost, because under this model nobody does. This
removes the "your offer was rejected whenever the other person completes the
request" complaint recorded in MAKEABOT TASKS #20.

`offer_closed` is new behaviour: `closeOffer` currently notifies nobody, so
pending inquirers discover it by noticing a card changed.

**No migration is required.** `notifications.type` is a plain `text` column, not
a pg enum, and none of the completion types have a column in
`notification_preferences` (only `new_inquiry`, `new_message`, `new_request`,
`new_offer`, and `email_digest` do). `push.service.ts` suppresses only when a
matching preference key exists and is false, so a type without a column is simply
never suppressed. The change is to the `NOTIFICATION_TYPES` array in
`lib/validation/notifications.ts` and to `IN_APP_ONLY_TYPES` in
`push.service.ts`.

---

## Consequential fixes this pulls in

**Tracker misfiles `Cancelled`.** `activeRequests` (posts tab) filters
`status !== "Completed"` and `historyRequests` filters `status === "Completed"`.
A `Cancelled` request satisfies the first and fails the second, so it would show
as **Active forever** — reintroducing the exact bug this spec exists to fix.
Active must become `status === "Active"`; history must accept both `Completed`
and `Cancelled`. The card should also distinguish the two, since "fulfilled" and
"nobody came" read very differently to the person reviewing their own history.

**Reopen has no parent check.** `reopenRequestBid` / `reopenOfferBid` set a bid
back to `Pending` without inspecting the parent. After this change a bidder can
reopen a live bid on a `Completed`, `Cancelled`, or `Closed` listing from the
home feed. Both must reject when the parent is not `Active`, with an `AppError`
the user can read.

---

## Implementation shape

The bid resolution is expressible as two `UPDATE ... RETURNING` statements inside
the existing transaction, in this order:

1. `Pending` bids on this request **that have at least one message** → `Completed`,
   returning `{ id, bidder_id }` — this is the notify-and-review set
2. whatever remains `Pending` (therefore message-less) → `Closed`

Running them in that order means the second needs no message predicate — the
first has already claimed every bid that qualifies. Doing it in SQL rather than
as a separate read keeps the message check inside the transaction, so a message
arriving mid-close cannot produce an inconsistent result.

`completeRequestAtomic` loses its `winningBidId` parameter and gains this shape.
Its ownership scoping, atomicity, and idempotency — all landed in remediation
Task 3 — are unchanged and still required. The `.returning()`-derived notify set
continues to exclude previously-withdrawn bidders for the same reason it does
today.

`[Dismiss]` follows the shape `completeOfferBid` already uses: fetch bid, fetch
offer, compare `offer.user_id` to the caller, then write. It needs the offer for
the notification body regardless, so this costs nothing extra and keeps one
pattern rather than introducing a third.

---

## Impact on the in-flight remediation branch

| Remediation task | Status under this spec |
|---|---|
| 1 — ownership on `completeOfferBid` | unchanged, still required |
| 2 — scoped withdraw/reopen | unchanged; reopen gains a parent check here |
| 3 — atomic `completeRequest` | reshaped: drops `winningBidId`, adds the message filter. Ownership/atomicity/idempotency all stand |
| 4 — action wiring, deferred name lookup | reshaped: winner/loser fan-out collapses to one uniform loop |
| 5 — `$onUpdate` on `updated_at` | unchanged |
| 6 — bid touches parent | unchanged |
| 7 — keep image on close | unchanged |
| 8 — pending state on the close button | unchanged; button is relabelled |
| 9 — review keys off `bidStatus` | mechanism unchanged; copy changes |

Recommended sequencing: land remediation Tasks 7 and 8, skip 9 on that branch,
merge it, then build this spec on top. The security and atomicity fixes are
shippable now and should not wait behind a UX change.

---

## Deliberately deferred to Spec B

Soft-delete and retention. Delete's cascade
(`requests` → `request_bids` → `messages` **and** `reviews`, all
`ON DELETE CASCADE`) means deleting a listing erases reviews in both directions —
including the review the owner *wrote about someone else*, which is that person's
earned reputation. `reports.reported_request_id` is `ON DELETE SET NULL`, so a
report survives its own evidence and a reported user can delete the chat log
after being reported.

The agreed direction is soft-delete everything for observability, plus a timed
purge (~30 days) that skips anything an open report references and never touches
reviews — consistent with `app/privacy/page.tsx` §6 ("delete or anonymize on a
best-effort basis") and §7 ("deletion **or blocking**"). The purge folds into
`expire-bids` rather than becoming a third cron, since the project sits at
exactly two and that is the Vercel Hobby ceiling.

This is a separate spec because it shares no code path with the close model, and
its real risk is the read-path sweep — every query in nine repo files needs
`deleted_at IS NULL`, and missing one leaks deleted content into a feed or a
public profile. That wants care, not the speed this spec is optimised for.

`Delete` and `Close` remain distinct user intents and both stay: Delete is
explicit removal of a post and its history; Close preserves.

## Also out of scope

- `Ongoing` (requests) and `Busy` (offers) remain declared and unwritten.
  Removing enum values requires DDL for no user-visible gain.
- `requireAuth()`'s per-action network round-trip — app-wide, belongs to Epic F.
- The non-constant-time `CRON_SECRET` comparison, and both cron routes accepting
  `Bearer undefined` when the env var is unset. Real, unrelated, worth its own fix.
