"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { AppError } from "@/lib/error/app-error";
import { requireAuth } from "@/lib/actions/auth";
import * as offersService from "@/lib/services/offers.service";
import * as requestsService from "@/lib/services/requests.service";
import * as usersService from "@/lib/services/users.service";
import * as reviewsService from "@/lib/services/reviews.service";
import { sendPushToUser } from "@/lib/services/push.service";
import { runAfterResponse } from "@/lib/after-response";

type DealKind = "offer" | "request";

export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<{
    parentStatus: string;
    bidStatus: string;
    ownerUserId: string | null;
    parentId: string;
    canReview: boolean;
  }>(async () => {
    const user = await requireAuth();

    // Review eligibility is decided by the server, once
    // (reviews.service.reviewEligibility). The client renders this boolean and
    // derives nothing from bidStatus.
    const canReview = (
      await reviewsService.reviewEligibility(bidId, kind, user.id)
    ).ok;

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");
      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");
      return {
        parentStatus: req.status,
        bidStatus: bid.status,
        ownerUserId: req.user_id,
        parentId: req.id,
        canReview,
      };
    }

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");
    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");
    return {
      parentStatus: offer.status,
      bidStatus: bid.status,
      ownerUserId: offer.user_id,
      parentId: offer.id,
      canReview,
    };
  });
}

export async function closeRequest(requestId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const { completed, request } = await requestsService.closeRequest(
      requestId,
      user.id,
    );

    // Deferred — the name lookup feeds the notification bodies only, and the
    // fan-out scales with the number of conversations.
    runAfterResponse(async () => {
      if (completed.length === 0) return;

      const requesterUsers = await usersService.getUsers({
        id: request.user_id ?? undefined,
      });
      const requesterName = requesterUsers[0]?.name ?? "Someone";

      await Promise.allSettled(
        completed.map((bid) =>
          sendPushToUser(bid.bidder_id, "request_closed", {
            title: "Request closed",
            body: `${requesterName} closed ${request.title}. Leave a review.`,
            url: `/chat?bidId=${bid.id}&kind=request&otherId=${request.user_id}&title=${encodeURIComponent(request.title)}`,
            contextId: null,
          }),
        ),
      );
    });

    return { success: true };
  });
}

export async function completeOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new AppError("Offer bid not found", 404);

    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new AppError("Offer not found", 404);

    const completed = await offersService.completeOfferBid(bidId, user.id);
    if (!completed) {
      if (offer.user_id !== user.id)
        throw new AppError("Only the offer owner can mark this done", 403);
      throw new AppError("This deal is already marked done", 409);
    }

    // Deferred — the name lookup feeds the push body only, so it must not sit
    // on the critical path.
    runAfterResponse(async () => {
      const offererUsers = await usersService.getUsers({
        id: offer.user_id ?? undefined,
      });
      const offererName = offererUsers[0]?.name ?? "Someone";

      await sendPushToUser(bid.bidder_id, "offer_bid_completed", {
        title: "Deal confirmed!",
        body: `${offererName} marked your deal on ${offer.title} as done.`,
        url: `/chat?bidId=${bidId}&kind=offer&otherId=${offer.user_id}&title=${encodeURIComponent(offer.title)}`,
        contextId: null,
      });
    });

    return { success: true };
  });
}

export async function dismissOfferBid(bidId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new AppError("Offer bid not found", 404);

    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new AppError("Offer not found", 404);

    const dismissed = await offersService.dismissOfferBid(bidId, user.id);
    if (!dismissed) {
      if (offer.user_id !== user.id)
        throw new AppError("Only the offer owner can dismiss this", 403);
      throw new AppError("This inquiry is no longer open", 409);
    }

    runAfterResponse(() =>
      sendPushToUser(bid.bidder_id, "offer_bid_dismissed", {
        title: "Inquiry closed",
        body: `Your inquiry on ${offer.title} was closed.`,
        url: `/`,
        contextId: null,
      }),
    );

    return { success: true };
  });
}

export async function closeOffer(offerId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    const affected = await offersService.closeOffer(offerId, user.id);

    runAfterResponse(async () => {
      if (affected.length === 0) return;

      const offersList = await offersService.getOffers({ id: offerId });
      const title = offersList[0]?.title ?? "an offer";

      await Promise.allSettled(
        affected.map((bid) =>
          sendPushToUser(bid.bidder_id, "offer_closed", {
            title: "Offer closed",
            body: `${title} is no longer available.`,
            url: `/`,
            contextId: null,
          }),
        ),
      );
    });

    return { success: true };
  });
}
