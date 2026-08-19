import * as reviewsRepo from "../repo/reviews.repo";
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import * as usersRepo from "../repo/users.repo";
import { sendPushToUser } from "./push.service";
import { runAfterResponse } from "../after-response";
import { oneBidRef } from "../reviews";
import { AppError } from "../error/app-error";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export type ReviewEligibility =
  | { ok: true }
  | {
      ok: false;
      reason: "not-found" | "not-completed" | "not-a-party" | "already-reviewed";
    };

/**
 * The two parties on a deal, plus the bid's status. Resolved once here so the
 * eligibility rule and the counterparty check never read the deal differently.
 */
async function dealParties(bidId: string, kind: "offer" | "request") {
  if (kind === "offer") {
    const bid = await offersRepo.findOfferBidById(bidId);
    if (!bid) return null;
    const offer = await offersRepo.findOfferById(bid.offer_id);
    return {
      status: bid.status as string,
      ids: new Set<string | null | undefined>([bid.bidder_id, offer?.user_id]),
    };
  }
  const bid = await requestsRepo.findRequestBidById(bidId);
  if (!bid) return null;
  const req = await requestsRepo.findRequestById(bid.request_id);
  return {
    status: bid.status as string,
    ids: new Set<string | null | undefined>([bid.bidder_id, req?.user_id]),
  };
}

/**
 * THE review rule — the only place that decides whether a user may review a
 * deal. Both the read path (`getDealStatus`) and the write path
 * (`createReview`) go through this, so a client can never be prompted for a
 * review the server would refuse.
 */
export async function reviewEligibility(
  bidId: string,
  kind: "offer" | "request",
  userId: string,
): Promise<ReviewEligibility> {
  const deal = await dealParties(bidId, kind);
  if (!deal) return { ok: false, reason: "not-found" };
  if (deal.status !== "Completed") return { ok: false, reason: "not-completed" };
  if (!deal.ids.has(userId)) return { ok: false, reason: "not-a-party" };

  const existing = await reviewsRepo.findReviewByCreatorAndBid(
    userId,
    kind,
    bidId,
  );
  if (existing) return { ok: false, reason: "already-reviewed" };

  return { ok: true };
}

export async function createReview(data: InsertReviewSchema) {
  if (data.creator_id === data.rated_user_id) {
    throw new AppError("You can't review yourself.", 400);
  }

  const ref = oneBidRef(data);
  if (!ref) {
    throw new AppError("A review must reference exactly one deal.", 400);
  }

  // The server decides eligibility in exactly one place. The counterparty
  // check runs between the two throws so the original precedence survives:
  // "not a completed deal you were part of" (403) outranks "already
  // reviewed" (409).
  const deal = await dealParties(ref.bidId, ref.kind);
  const eligibility = await reviewEligibility(
    ref.bidId,
    ref.kind,
    data.creator_id,
  );

  const notPartOfDeal =
    (!eligibility.ok && eligibility.reason !== "already-reviewed") ||
    !deal?.ids.has(data.rated_user_id);
  if (notPartOfDeal) {
    throw new AppError(
      "You can only review a completed deal you were part of.",
      403,
    );
  }
  if (!eligibility.ok) {
    throw new AppError("You've already reviewed this deal.", 409);
  }

  const review = await reviewsRepo.insertReview(data);

  // Bell-only: reviews drive the trust model so the rated user must be told,
  // but a landed review isn't urgent enough to buzz.
  runAfterResponse(async () => {
    try {
      const [reviewer] = await usersRepo.findUsers({ id: data.creator_id });
      const reviewerName = reviewer?.name ?? "Someone";
      await sendPushToUser(data.rated_user_id, "new_review", {
        title: `${reviewerName} left you a review`,
        body: data.comment?.trim()
          ? data.comment.slice(0, 80)
          : `${reviewerName} rated your completed deal.`,
        url: `/profile/${data.rated_user_id}`,
        contextId: null,
      });
    } catch {
      // notification failure must never block review creation
    }
  });

  return review;
}

export async function removeReview(id: string, userId: string) {
  return await reviewsRepo.deleteReview(id, userId);
}
