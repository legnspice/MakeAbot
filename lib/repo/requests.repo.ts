import { and, eq, lte, ilike, gte, desc, ne, lt, inArray } from "drizzle-orm";
import { db } from "../db";
import { requests, request_bids } from "../db/schema";
import { getDayRange } from "./helper";
import { hasEmptyBatch } from "../batch";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
  UpdateRequestSchema,
} from "@/lib/validation/requests";

export async function findRequestById(id: string) {
  return await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
}

export async function findRequestBidById(id: string) {
  return await db.query.request_bids.findFirst({
    where: eq(request_bids.id, id),
  });
}

export async function findRequests(filters: FindRequestsSchema) {
  const { id, user_id, fee, title, status, urgency, created_at, ids } = filters;
  if (hasEmptyBatch(ids)) return [];
  const conditions = [];

  // If the filter exists, use the filter for the query.
  if (id) conditions.push(eq(requests.id, id));
  if (ids && ids.length > 0) conditions.push(inArray(requests.id, ids));
  if (user_id) conditions.push(eq(requests.user_id, user_id));
  if (fee) conditions.push(lte(requests.fee, fee));
  if (status) conditions.push(eq(requests.status, status));
  if (urgency) conditions.push(eq(requests.urgency, urgency));
  if (title) conditions.push(ilike(requests.title, `%${title}%`));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(requests.created_at, startOfDay));
    conditions.push(lte(requests.created_at, endOfDay));
  }

  return await db.query.requests.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(requests.created_at)],
  });
}

export async function findRequestBids(filters: FindRequestBidsSchema) {
  const { id, request_id, bidder_id, created_at, request_ids } = filters;
  if (hasEmptyBatch(request_ids)) return [];
  const conditions = [];

  if (id) conditions.push(eq(request_bids.id, id));
  if (request_id) conditions.push(eq(request_bids.request_id, request_id));
  if (request_ids && request_ids.length > 0)
    conditions.push(inArray(request_bids.request_id, request_ids));
  if (bidder_id) conditions.push(eq(request_bids.bidder_id, bidder_id));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(request_bids.created_at, startOfDay));
    conditions.push(lte(request_bids.created_at, endOfDay));
  }

  return await db.query.request_bids.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(request_bids.created_at)],
  });
}

export async function insertRequest(data: InsertRequestSchema) {
  const [request] = await db.insert(requests).values(data).returning();
  return request;
}

export async function insertRequestBid(data: InsertRequestBidSchema) {
  const [bid] = await db.insert(request_bids).values(data).returning();
  return bid;
}

export async function deleteRequest(id: string, userId: string) {
  return await db
    .delete(requests)
    .where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}

export async function deleteRequestBid(id: string, userId: string) {
  return await db
    .delete(request_bids)
    .where(and(eq(request_bids.id, id), eq(request_bids.bidder_id, userId)));
}

export async function updateRequest(
  id: string,
  data: UpdateRequestSchema,
  userId: string,
) {
  return await db
    .update(requests)
    .set(data)
    .where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}

export async function updateRequestBidStatus(
  bidId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(eq(request_bids.id, bidId));
}

/** Set all Pending bids on a request to Closed, except the winner */
export async function bulkCloseRequestBids(
  requestId: string,
  exceptBidId: string,
) {
  return await db
    .update(request_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(request_bids.request_id, requestId),
        eq(request_bids.status, "Pending"),
        ne(request_bids.id, exceptBidId),
      ),
    );
}

/** Find all Pending request_bids whose parent request updated_at < 14 days ago */
export async function expireStaleRequestBids(): Promise<
  { bidId: string; bidderId: string; requestTitle: string }[]
> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({
      bidId: request_bids.id,
      bidderId: request_bids.bidder_id,
      requestTitle: requests.title,
    })
    .from(request_bids)
    .innerJoin(requests, eq(request_bids.request_id, requests.id))
    .where(
      and(eq(request_bids.status, "Pending"), lt(requests.updated_at, cutoff)),
    );

  if (stale.length === 0) return [];

  const staleIds = stale.map((r) => r.bidId);
  await db
    .update(request_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(request_bids.status, "Pending"),
        inArray(request_bids.id, staleIds),
      ),
    );

  return stale;
}
