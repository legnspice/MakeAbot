"use server";

import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import * as offersService from "@/lib/services/offers.service";
import * as requestsService from "@/lib/services/requests.service";
import * as usersService from "@/lib/services/users.service";
import { sendPushToUser } from "@/lib/services/push.service";
import { runAfterResponse } from "@/lib/after-response";

type DealKind = "offer" | "request";

export async function getDealStatus(bidId: string, kind: DealKind) {
  return await handleAction<{
    parentStatus: string;
    bidStatus: string;
    ownerUserId: string | null;
    parentId: string;
  }>(async () => {
    await requireAuth();

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
    };
  });
}

export async function completeRequest(requestId: string, winningBidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const { winnerBid, loserBids, request } =
      await requestsService.completeRequest(requestId, winningBidId);

    // Fetch requester display name
    const requesterUsers = await usersService.getUsers({
      id: request.user_id ?? undefined,
    });
    const requesterName = requesterUsers[0]?.name ?? "Someone";

    // Deferred — must not hold up the action response, especially the loser
    // fan-out which scales with bid count.
    runAfterResponse(async () => {
      await Promise.allSettled([
        ...(winnerBid
          ? [
              sendPushToUser(winnerBid.bidder_id, "request_completed_winner", {
                title: "Your offer was accepted!",
                body: `${requesterName} marked your bid on ${request.title} as done.`,
                url: `/chat?bidId=${winningBidId}&kind=request&otherId=${request.user_id}&title=${encodeURIComponent(request.title)}`,
                contextId: null,
              }),
            ]
          : []),
        ...loserBids.map((loser) =>
          sendPushToUser(loser.bidder_id, "request_completed_loser", {
            title: "Request fulfilled",
            body: `${request.title} has been fulfilled by someone else.`,
            url: `/`,
            contextId: null,
          }),
        ),
      ]);
    });

    return { success: true };
  });
}

export async function completeOfferBid(bidId: string) {
  return await handleAction(async () => {
    await requireAuth();

    const bids = await offersService.getOfferBids({ id: bidId });
    const bid = bids[0];
    if (!bid) throw new Error("Offer bid not found");

    const offersList = await offersService.getOffers({ id: bid.offer_id });
    const offer = offersList[0];
    if (!offer) throw new Error("Offer not found");

    // Fetch offerer display name
    const offererUsers = await usersService.getUsers({
      id: offer.user_id ?? undefined,
    });
    const offererName = offererUsers[0]?.name ?? "Someone";

    await offersService.completeOfferBid(bidId);

    // Deferred — the caller shouldn't wait on push delivery
    runAfterResponse(() =>
      sendPushToUser(bid.bidder_id, "offer_bid_completed", {
        title: "Deal confirmed!",
        body: `${offererName} marked your deal on ${offer.title} as done.`,
        url: `/chat?bidId=${bidId}&kind=offer&otherId=${offer.user_id}&title=${encodeURIComponent(offer.title)}`,
        contextId: null,
      }),
    );

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
