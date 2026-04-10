import * as requestsRepo from "../repo/requests.repo";
import { sendPushToAllUsers } from "./push.service";
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
    // fire-and-forget — failure must not throw
    sendPushToAllUsers(data.user_id, {
      title: "New request posted",
      body: data.title,
      url: `/`,
    }).catch(() => {});
  }
  return request;
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
}

export async function acceptRequestBid(bidId: string, _requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Accepted");
}

export async function rejectRequestBid(bidId: string, _requestOwnerId: string) {
  await requestsRepo.updateRequestBidStatus(bidId, "Closed");
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
