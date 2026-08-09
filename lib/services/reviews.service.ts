import * as reviewsRepo from "../repo/reviews.repo";
import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import { oneBidRef } from "../reviews";
import { AppError } from "../error/app-error";
import { FindReviewsSchema, InsertReviewSchema } from "../validation/reviews";

export async function getReviews(filters: FindReviewsSchema) {
  return await reviewsRepo.findReviews(filters);
}

export async function createReview(data: InsertReviewSchema) {
  if (data.creator_id === data.rated_user_id) {
    throw new AppError("You can't review yourself.", 400);
  }

  const ref = oneBidRef(data);
  if (!ref) {
    throw new AppError("A review must reference exactly one deal.", 400);
  }

  // Verify the referenced bid is a COMPLETED deal linking the reviewer and the rated user.
  let bidderId: string | undefined;
  let ownerId: string | null | undefined;
  let status: string | undefined;
  if (ref.kind === "offer") {
    const bid = await offersRepo.findOfferBidById(ref.bidId);
    if (bid) {
      bidderId = bid.bidder_id;
      status = bid.status;
      const offer = await offersRepo.findOfferById(bid.offer_id);
      ownerId = offer?.user_id;
    }
  } else {
    const bid = await requestsRepo.findRequestBidById(ref.bidId);
    if (bid) {
      bidderId = bid.bidder_id;
      status = bid.status;
      const req = await requestsRepo.findRequestById(bid.request_id);
      ownerId = req?.user_id;
    }
  }

  const parties = new Set([bidderId, ownerId]);
  const linksBoth =
    parties.has(data.creator_id) && parties.has(data.rated_user_id);
  if (status !== "Completed" || !linksBoth) {
    throw new AppError(
      "You can only review a completed deal you were part of.",
      403,
    );
  }

  // One review per reviewer per deal.
  const existing = await reviewsRepo.findReviewByCreatorAndBid(
    data.creator_id,
    ref.kind,
    ref.bidId,
  );
  if (existing) {
    throw new AppError("You've already reviewed this deal.", 409);
  }

  return await reviewsRepo.insertReview(data);
}

export async function removeReview(id: string, userId: string) {
  return await reviewsRepo.deleteReview(id, userId);
}
