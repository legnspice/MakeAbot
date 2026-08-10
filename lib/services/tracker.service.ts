import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import * as usersRepo from "../repo/users.repo";
import { indexById, groupBidsByParent } from "../tracker";
import type {
  SelectOffer,
  SelectOfferBid,
  SelectRequest,
  SelectRequestBid,
} from "../db/schema";

export type TrackerData = {
  offerBidGroups: { offer: SelectOffer; bids: SelectOfferBid[] }[];
  reqBidGroups: { req: SelectRequest; bids: SelectRequestBid[] }[];
  bidOfferGroups: { bid: SelectOfferBid; offer: SelectOffer | null }[];
  bidReqGroups: { bid: SelectRequestBid; req: SelectRequest | null }[];
  userNames: Record<string, string>;
};

export async function getTrackerData(userId: string): Promise<TrackerData> {
  // 1. Base queries (parallel).
  const [ownedOffers, ownedRequests, myOfferBids, myReqBids] =
    await Promise.all([
      offersRepo.findOffers({ user_id: userId }),
      requestsRepo.findRequests({ user_id: userId }),
      offersRepo.findOfferBids({ bidder_id: userId }),
      requestsRepo.findRequestBids({ bidder_id: userId }),
    ]);

  // 2. Batched hydration (parallel).
  const [bidsOnOwnedOffers, bidsOnOwnedRequests, bidOffers, bidRequests] =
    await Promise.all([
      offersRepo.findOfferBids({ offer_ids: ownedOffers.map((o) => o.id) }),
      requestsRepo.findRequestBids({
        request_ids: ownedRequests.map((r) => r.id),
      }),
      offersRepo.findOffers({ ids: myOfferBids.map((b) => b.offer_id) }),
      requestsRepo.findRequests({ ids: myReqBids.map((b) => b.request_id) }),
    ]);

  // 3. Group in memory (mirrors the old client fan-out shapes exactly).
  const bidsByOffer = groupBidsByParent(bidsOnOwnedOffers, (b) => b.offer_id);
  const bidsByRequest = groupBidsByParent(
    bidsOnOwnedRequests,
    (b) => b.request_id,
  );
  const offerById = indexById(bidOffers);
  const requestById = indexById(bidRequests);

  const offerBidGroups = ownedOffers.map((offer) => ({
    offer,
    bids: bidsByOffer.get(offer.id) ?? [],
  }));
  const reqBidGroups = ownedRequests.map((req) => ({
    req,
    bids: bidsByRequest.get(req.id) ?? [],
  }));
  const bidOfferGroups = myOfferBids.map((bid) => ({
    bid,
    offer: offerById.get(bid.offer_id) ?? null,
  }));
  const bidReqGroups = myReqBids.map((bid) => ({
    bid,
    req: requestById.get(bid.request_id) ?? null,
  }));

  // 4. One batched name lookup for every counterparty.
  const userIds = new Set<string>();
  for (const g of offerBidGroups) for (const b of g.bids) userIds.add(b.bidder_id);
  for (const g of reqBidGroups) for (const b of g.bids) userIds.add(b.bidder_id);
  for (const g of bidOfferGroups) if (g.offer?.user_id) userIds.add(g.offer.user_id);
  for (const g of bidReqGroups) if (g.req?.user_id) userIds.add(g.req.user_id);

  const userNames: Record<string, string> = {};
  if (userIds.size > 0) {
    const users = await usersRepo.findUsers({ ids: Array.from(userIds) });
    for (const u of users) userNames[u.id] = u.name ?? "User";
  }

  return { offerBidGroups, reqBidGroups, bidOfferGroups, bidReqGroups, userNames };
}
