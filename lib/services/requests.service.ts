import * as requestsRepo from "../repo/requests.repo";
import { sendPushToAllUsers } from "./push.service";
import { tierAfterPosterCooldown } from "./broadcast.service";
import { requestBroadcastTier } from "../broadcast-policy";
import { runAfterResponse } from "../after-response";
import { AppError } from "@/lib/error/app-error";
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
  if (request && data.user_id) {
    const userId = data.user_id;
    // Deferred to after the response — must not block or fail request creation.
    runAfterResponse(async () => {
      const tier = await tierAfterPosterCooldown(
        requestBroadcastTier(request.urgency),
        userId,
        { requestId: request.id },
      );
      await sendPushToAllUsers(userId, "new_request", tier, {
        title: "New request posted",
        body: data.title,
        url: `/`,
      });
    });
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
}

export async function completeRequest(
  requestId: string,
  winningBidId: string,
  callerId: string,
) {
  const req = await requestsRepo.findRequestById(requestId);
  if (!req) throw new AppError("Request not found", 404);
  if (req.user_id !== callerId)
    throw new AppError("Only the requester can mark this done", 403);
  if (req.status === "Completed")
    throw new AppError("This request is already completed", 409);

  const winnerBid = await requestsRepo.findRequestBidById(winningBidId);
  if (!winnerBid || winnerBid.request_id !== requestId)
    throw new AppError("That bid is not on this request", 400);

  const { closedLosers } = await requestsRepo.completeRequestAtomic(
    requestId,
    winningBidId,
    callerId,
  );

  // Return winner/loser bids for notification dispatch by caller
  return { winnerBid, loserBids: closedLosers, request: req };
}

export async function expireStaleRequestBids() {
  return await requestsRepo.expireStaleRequestBids();
}

export async function removeRequest(id: string, userId: string) {
  return await requestsRepo.deleteRequest(id, userId);
}

export async function removeRequestBid(id: string, userId: string) {
  return await requestsRepo.deleteRequestBid(id, userId);
}

export async function withdrawRequestBid(bidId: string, bidderId: string) {
  return await requestsRepo.updateRequestBidStatusForBidder(bidId, bidderId, "Closed");
}

export async function reopenRequestBid(bidId: string, bidderId: string) {
  return await requestsRepo.updateRequestBidStatusForBidder(bidId, bidderId, "Pending");
}

export async function editRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  return await requestsRepo.updateRequest(id, data, userId);
}
