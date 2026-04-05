"use server";

import * as requestsService from "@/lib/services/requests.service";
import { handleAction } from "@/lib/error/actions-handler";
import { requireAuth } from "@/lib/actions/auth";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function getRequests(filters: FindRequestsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.getRequests(filters);
  });
}

export async function getRequestBids(filters: FindRequestBidsSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.getRequestBids(filters);
  });
}

export async function createRequest(data: InsertRequestSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.createRequest({ ...data, user_id: user.id });
  });
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.createRequestBid({ ...data, bidder_id: user.id });
  });
}

export async function removeRequest(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.removeRequest(id, user.id);
  });
}

export async function removeRequestBid(id: string) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.removeRequestBid(id, user.id);
  });
}

export async function editRequest(id: string, data: UpdateRequestSchema) {
  return await handleAction(async () => {
    const user = await requireAuth();
    return requestsService.editRequest(id, data, user.id);
  });
}
