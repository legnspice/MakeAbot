"use server";

import { createClient } from "@/lib/supabase/server";
import * as requestsService from "@/lib/services/requests.service";
import { handleAction } from "@/lib/error/actions-handler";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

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
    await requireAuth();
    return requestsService.createRequest(data);
  });
}

export async function createRequestBid(data: InsertRequestBidSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.createRequestBid(data);
  });
}

export async function removeRequest(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.removeRequest(id);
  });
}

export async function removeRequestBid(id: string) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.removeRequestBid(id);
  });
}

export async function editRequest(id: string, data: UpdateRequestSchema) {
  return await handleAction(async () => {
    await requireAuth();
    return requestsService.editRequest(id, data);
  });
}
