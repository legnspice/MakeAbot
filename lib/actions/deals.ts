"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import * as offersService from "@/lib/services/offers.service";
import * as requestsService from "@/lib/services/requests.service";
import { sendPushToUser } from "@/lib/services/push.service";

type DealKind = "offer" | "request";

export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<{ parentStatus: string; ownerUserId: string | null }>(async () => {
    await requireAuth();

    if (kind === "request") {
      const bids = await requestsService.getRequestBids({ id: bidId });
      const bid = bids[0];
      if (!bid) throw new Error("Request bid not found");
      const reqs = await requestsService.getRequests({ id: bid.request_id });
      const req = reqs[0];
      if (!req) throw new Error("Request not found");
      return { parentStatus: req.status, ownerUserId: req.user_id };
    }

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");
    const offersList = await offersService.getOffers({ id: bid.post_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");
    return { parentStatus: offer.status, ownerUserId: offer.user_id };
  });
}

export async function completeRequest(requestId: string, winningBidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const { winnerBid, loserBids, request } =
      await requestsService.completeRequest(requestId, winningBidId);

    if (!request) return { success: true };

    // Notify winner
    if (winnerBid) {
      await sendPushToUser(winnerBid.bidder_id, "request_completed_winner", {
        title: "Your offer was accepted!",
        body: `${request.title} has been marked as done.`,
        url: `/reviews/new?targetId=${request.user_id}&context=${requestId}`,
        contextId: null,
      }).catch(() => {});
    }

    // Notify losers
    for (const loser of loserBids) {
      await sendPushToUser(loser.bidder_id, "request_completed_loser", {
        title: "Request fulfilled",
        body: `${request.title} has been fulfilled by someone else.`,
        url: `/`,
        contextId: null,
      }).catch(() => {});
    }

    return { success: true };
  });
}

export async function completeOfferBid(bidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");

    const offersList = await offersService.getOffers({ id: bid.post_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");

    await offersService.completeOfferBid(bidId);

    await sendPushToUser(bid.bidder_id, "offer_bid_completed", {
      title: "Deal confirmed!",
      body: `${offer.user_id} marked your deal on ${offer.title} as done.`,
      url: `/reviews/new?targetId=${offer.user_id}&context=${offer.id}`,
      contextId: null,
    }).catch(() => {});

    return { success: true };
  });
}

export async function closeOffer(offerId: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    await offersService.closeOffer(offerId, user.id);
    return { success: true };
  });
}
