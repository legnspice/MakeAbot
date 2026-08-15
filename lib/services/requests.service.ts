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

export async function completeRequest(requestId: string, winningBidId: string) {
  const req = await requestsRepo.findRequestById(requestId);
  if (!req) throw new AppError("Request not found", 404);

  await requestsRepo.updateRequestBidStatus(winningBidId, "Completed");
  await requestsRepo.bulkCloseRequestBids(requestId, winningBidId);
  await requestsRepo.updateRequest(
    requestId,
    { status: "Completed", completed_at: new Date() },
    req.user_id!,
  );
  // Return winner/loser bids for notification dispatch by caller
  const allBids = await requestsRepo.findRequestBids({ request_id: requestId });
  const loserBids = allBids.filter(
    (b) => b.id !== winningBidId && b.status === "Closed",
  );
  const winnerBid = allBids.find((b) => b.id === winningBidId);
  return { winnerBid, loserBids, request: req };
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

export async function withdrawRequestBid(bidId: string) {
  return await requestsRepo.updateRequestBidStatus(bidId, "Closed");
}

export async function reopenRequestBid(bidId: string) {
  return await requestsRepo.updateRequestBidStatus(bidId, "Pending");
}

export async function editRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  return await requestsRepo.updateRequest(id, data, userId);
}
