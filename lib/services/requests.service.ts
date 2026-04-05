import * as requestsRepo from "../repo/requests.repo";
import { sendPushToUser, sendPushToAllUsers } from "./push.service";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function getRequests(filters: FindRequestsSchema) {
  return await requestsRepo.findRequests(filters);
}

export async function getRequestBids(filters: FindRequestBidsSchema) {
  return await requestsRepo.findRequestBids(filters);
}

export async function createRequest(data: InsertRequestSchema) {
  const request = await requestsRepo.insertRequest(data);
  if (data.user_id) {
    // fire-and-forget — failure must not throw
    sendPushToAllUsers(data.user_id, {
      title: "New request posted",
      body: data.title,
      url: `/requests/${request.id}`,
    }).catch(() => {});
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  const bid = await requestsRepo.insertRequestBid(data);
  // fire-and-forget
  (async () => {
    try {
      const request = await requestsRepo.findRequestById(data.request_id);
      if (request?.user_id) {
        await sendPushToUser(request.user_id, "new_bid", {
          title: `New offer for "${request.title}"`,
          body: "Someone offered to help",
          url: `/chat?bidId=${bid.id}&kind=request&title=${encodeURIComponent(request.title)}&otherId=${data.bidder_id}`,
        });
      }
    } catch {}
  })();
  return bid;
}

export async function acceptRequestBid(bidId: string, requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Accepted");
  // fire-and-forget
  (async () => {
    try {
      const bid = await requestsRepo.findRequestBidById(bidId);
      if (bid) {
        const request = await requestsRepo.findRequestById(bid.request_id);
        await sendPushToUser(bid.bidder_id, "bid_accepted", {
          title: "Your offer was accepted",
          body: request ? `For "${request.title}"` : "",
          url: `/chat?bidId=${bidId}&kind=request&title=${encodeURIComponent(request?.title ?? "")}&otherId=${requestOwnerId}`,
        });
      }
    } catch {}
  })();
}

export async function rejectRequestBid(bidId: string, _requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Closed");
  // fire-and-forget
  (async () => {
    try {
      const bid = await requestsRepo.findRequestBidById(bidId);
      if (bid) {
        const request = await requestsRepo.findRequestById(bid.request_id);
        await sendPushToUser(bid.bidder_id, "bid_rejected", {
          title: "Your offer was not accepted",
          body: request ? `For "${request.title}"` : "",
          url: "/notifications",
        });
      }
    } catch {}
  })();
}

export async function removeRequest(id: string, userId: string) {
  return await requestsRepo.deleteRequest(id, userId);
}

export async function removeRequestBid(id: string, userId: string) {
  return await requestsRepo.deleteRequestBid(id, userId);
}

export async function editRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  return await requestsRepo.updateRequest(id, data, userId);
}
