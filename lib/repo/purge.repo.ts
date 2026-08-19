import { and, eq, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "../db";
import {
  messages,
  offer_bids,
  offers,
  request_bids,
  requests,
} from "../db/schema";
import { deleteStorageObject } from "../supabase/storage";
import * as reportsRepo from "./reports.repo";
import { retentionCutoff } from "./soft-delete";

/**
 * Placeholder for an anonymized listing.
 *
 * `title` is NOT NULL, so it cannot be nulled — and it doubles as the
 * "already anonymized" marker that makes a second sweep a genuine no-op.
 */
export const ANONYMIZED_TITLE = "[deleted]";

export type PurgeSummary = {
  requests: number;
  offers: number;
  messagesDeleted: number;
  skippedReported: number;
  storageFailures: number;
};

/**
 * A listing due for anonymization.
 *
 * `updated_at` is carried along only so it can be written back unchanged:
 * the column has an `$onUpdate` hook, so any `db.update` that omits it would
 * silently bump it — and `expireStale*Bids` measures bid staleness against
 * that column. Anonymizing a tombstone must not restart anyone's clock.
 */
type Candidate = { id: string; imgUrl: string | null; updated_at: Date };

/**
 * Requests soft-deleted before the cutoff that still hold their content.
 *
 * Deliberately not named `find*` — `soft-delete-coverage.test.ts` enumerates
 * `find`/`get`/`has` exports and demands a `notDeleted()` filter, which is the
 * exact opposite of what this sweep looks for.
 */
async function dueRequests(cutoff: Date): Promise<Candidate[]> {
  return await db
    .select({
      id: requests.id,
      imgUrl: requests.imgUrl,
      updated_at: requests.updated_at,
    })
    .from(requests)
    .where(
      and(
        isNotNull(requests.deleted_at),
        lt(requests.deleted_at, cutoff),
        ne(requests.title, ANONYMIZED_TITLE),
      ),
    );
}

/** Offers soft-deleted before the cutoff that still hold their content. */
async function dueOffers(cutoff: Date): Promise<Candidate[]> {
  return await db
    .select({
      id: offers.id,
      imgUrl: offers.imgUrl,
      updated_at: offers.updated_at,
    })
    .from(offers)
    .where(
      and(
        isNotNull(offers.deleted_at),
        lt(offers.deleted_at, cutoff),
        ne(offers.title, ANONYMIZED_TITLE),
      ),
    );
}

/**
 * Hard-delete the chat under one request, reached through its bids.
 *
 * The bids themselves are READ ONLY. `reviews` cascades from `request_bids`,
 * so deleting a bid would destroy the reviews on both sides of that deal —
 * including reviews written *about* other people. See spec D2. A tombstoned
 * bid is a few dozen bytes and is kept forever.
 */
async function deleteRequestMessages(requestId: string): Promise<number> {
  const bids = await db
    .select({ id: request_bids.id })
    .from(request_bids)
    .where(eq(request_bids.request_id, requestId));
  if (bids.length === 0) return 0;

  const deleted = await db
    .delete(messages)
    .where(
      inArray(
        messages.request_bid_id,
        bids.map((b) => b.id),
      ),
    )
    .returning({ id: messages.id });
  return deleted.length;
}

/** Hard-delete the chat under one offer, reached through its bids (read only). */
async function deleteOfferMessages(offerId: string): Promise<number> {
  const bids = await db
    .select({ id: offer_bids.id })
    .from(offer_bids)
    .where(eq(offer_bids.offer_id, offerId));
  if (bids.length === 0) return 0;

  const deleted = await db
    .delete(messages)
    .where(
      inArray(
        messages.offer_bid_id,
        bids.map((b) => b.id),
      ),
    )
    .returning({ id: messages.id });
  return deleted.length;
}

/**
 * Nightly retention sweep: strip the content of listings that have been
 * soft-deleted for longer than the retention window.
 *
 * `now` is a parameter so callers (and tests) pin the clock; the cron passes
 * `new Date()`. Listings with an open report are left intact so a reported
 * user cannot delete the evidence and wait out the window.
 */
export async function purgeDueListings(now: Date): Promise<PurgeSummary> {
  const cutoff = retentionCutoff(now);

  const [requestCandidates, offerCandidates] = await Promise.all([
    dueRequests(cutoff),
    dueOffers(cutoff),
  ]);

  const summary: PurgeSummary = {
    requests: 0,
    offers: 0,
    messagesDeleted: 0,
    skippedReported: 0,
    storageFailures: 0,
  };
  if (requestCandidates.length === 0 && offerCandidates.length === 0) {
    return summary;
  }

  const reported = await reportsRepo.findOpenReportTargetIds(
    requestCandidates.map((c) => c.id),
    offerCandidates.map((c) => c.id),
  );

  /** Drop the image only after the row no longer points at it. */
  const dropImage = async (url: string | null) => {
    if (!url) return;
    const ok = await deleteStorageObject(url);
    if (!ok) summary.storageFailures += 1;
  };

  for (const candidate of requestCandidates) {
    if (reported.requestIds.has(candidate.id)) {
      summary.skippedReported += 1;
      continue;
    }
    // imgUrl is captured in `candidate` before the update nulls it; without
    // that the storage object could never be located again.
    summary.messagesDeleted += await deleteRequestMessages(candidate.id);
    await db
      .update(requests)
      .set({
        title: ANONYMIZED_TITLE,
        description: null,
        incentive: null,
        imgUrl: null,
        updated_at: candidate.updated_at,
      })
      .where(eq(requests.id, candidate.id));
    summary.requests += 1;
    await dropImage(candidate.imgUrl);
  }

  for (const candidate of offerCandidates) {
    if (reported.offerIds.has(candidate.id)) {
      summary.skippedReported += 1;
      continue;
    }
    summary.messagesDeleted += await deleteOfferMessages(candidate.id);
    await db
      .update(offers)
      .set({
        title: ANONYMIZED_TITLE,
        description: null,
        incentive: null,
        imgUrl: null,
        updated_at: candidate.updated_at,
      })
      .where(eq(offers.id, candidate.id));
    summary.offers += 1;
    await dropImage(candidate.imgUrl);
  }

  return summary;
}
