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
  // Look up the parent once, up front. A lookup failure here must not block
  // the bid (matches the best-effort staleness touch below), so a thrown
  // read is swallowed and treated as "parent unknown" rather than rejecting
  // the bid outright. The guard below only fires when we positively know the
  // offer is not Active — it must run before the insert.
  let offer: Awaited<ReturnType<typeof offersRepo.findOfferById>> | undefined;
  try {
    offer = await offersRepo.findOfferById(data.offer_id);
  } catch {
    // Lookup failure only — fall through, see staleness note below.
  }

  if (offer && offer.status !== "Active") {
    throw new AppError("This offer is no longer accepting inquiries", 409);
  }

  const bid = await offersRepo.insertOfferBid(data);

  // A new bid is activity: reset the parent's staleness clock so
  // expireStaleOfferBids does not close live bids on a busy old offer.
  // Best-effort — a failed touch must never fail the bid.
  try {
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
  const withdrawn = await offersRepo.withdrawOfferBidForBidder(bidId, bidderId);
  if (!withdrawn)
    throw new AppError("This inquiry can no longer be withdrawn", 409);
}

export async function reopenOfferBid(bidId: string, bidderId: string) {
  const bid = await offersRepo.findOfferBidById(bidId);
  if (bid) {
    const offer = await offersRepo.findOfferById(bid.offer_id);
    if (!offer || offer.status !== "Active") {
      throw new AppError("This listing is no longer open", 409);
    }
  }
  return await offersRepo.updateOfferBidStatusForBidder(bidId, bidderId, "Pending");
}

export async function editOffer(
  id: string,
  data: UpdateOfferSchema,
  userId: string,
) {
  const offer = await offersRepo.findOfferById(id);
  if (!offer || offer.status !== "Active") {
    throw new AppError("This offer is closed and can no longer be edited", 409);
  }
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
