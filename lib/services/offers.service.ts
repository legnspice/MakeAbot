import * as offersRepo from "../repo/offers.repo";
import { sendPushToAllUsers } from "./push.service";
import { tierAfterPosterCooldown } from "./broadcast.service";
import { offerBroadcastTier } from "../broadcast-policy";
import { runAfterResponse } from "../after-response";
import { AppError } from "@/lib/error/app-error";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
  UpdateOfferSchema,
} from "../validation/offers";

export async function getOffers(filters: FindOffersSchema) {
  return await offersRepo.findOffers(filters);
}

export async function getOfferBids(filters: FindOfferBidsSchema) {
  return await offersRepo.findOfferBids(filters);
}

export async function createOffer(data: InsertOfferSchema) {
  const offer = await offersRepo.insertOffer(data);
  if (offer && data.user_id) {
    const userId = data.user_id;
    // Deferred to after the response — must not block or fail offer creation.
    runAfterResponse(async () => {
      const tier = await tierAfterPosterCooldown(offerBroadcastTier(), userId, {
        offerId: offer.id,
      });
      await sendPushToAllUsers(userId, "new_offer", tier, {
        title: "New offer available",
        body: data.title,
        url: `/`,
      });
    });
  }
  return offer;
}

export async function createOfferBid(data: InsertOfferBidSchema) {
  const bid = await offersRepo.insertOfferBid(data);

  // A new bid is activity: reset the parent's staleness clock so
  // expireStaleOfferBids does not close live bids on a busy old offer.
  // Best-effort — a failed touch must never fail the bid.
  try {
    const offer = await offersRepo.findOfferById(data.offer_id);
    if (offer?.user_id)
      await offersRepo.updateOffer(
        data.offer_id,
        { updated_at: new Date() },
        offer.user_id,
      );
  } catch {
    // Staleness bookkeeping only.
  }

  return bid;
}

export async function removeOffer(id: string, userId: string) {
  return await offersRepo.deleteOffer(id, userId);
}

export async function removeOfferBid(id: string, userId: string) {
  return await offersRepo.deleteOfferBid(id, userId);
}

export async function withdrawOfferBid(bidId: string, bidderId: string) {
  return await offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, "Closed");
}

export async function reopenOfferBid(bidId: string, bidderId: string) {
  return await offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, "Pending");
}

export async function editOffer(
  id: string,
  data: UpdateOfferSchema,
  userId: string,
) {
  return await offersRepo.updateOffer(id, { ...data }, userId);
}

export async function closeOffer(id: string, userId: string) {
  const closed = await offersRepo.closeOfferAtomic(id, userId);
  if (!closed) throw new AppError("Only the offer owner can close this", 403);
}

export async function completeOfferBid(bidId: string, ownerId: string) {
  return await offersRepo.completeOfferBidForOwner(bidId, ownerId);
}

export async function expireStaleOfferBids() {
  return await offersRepo.expireStaleOfferBids();
}
