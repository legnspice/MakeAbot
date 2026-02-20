import * as requestsRepo from "../repo/requests.repo";
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
  return await requestsRepo.insertRequest(data);
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await requestsRepo.insertRequestBid(data);
}

export async function removeRequest(id: string) {
  return await requestsRepo.deleteRequest(id);
}

export async function removeRequestBid(id: string) {
  return await requestsRepo.deleteRequestBid(id);
}

export async function editRequest(id: string, data: UpdateRequestSchema) {
  return await requestsRepo.updateRequest(id, data);
}
