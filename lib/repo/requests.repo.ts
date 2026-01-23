import { and, eq, lte, ilike, gte, desc } from "drizzle-orm";
import { db } from "../db";
import { requests, RequestStatus, Urgency, request_bids } from "../db/schema";
import { getDayRange } from "./helper";

export async function findRequests(filters: {
  id?: string;
  user_id?: string;
  fee?: number;
  title?: string;
  status?: RequestStatus;
  created_at?: Date;
  urgency?: Urgency;
}) {
  const { id, user_id, fee, title, status, urgency, created_at } = filters;
  const conditions = [];

  // If the filter exists, use the filter for the query.
  if (id) conditions.push(eq(requests.id, id));
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

export async function findRequestBids(filters: {
  id?: string;
  request_id?: string;
  bidder_id?: string;
  created_at?: Date;
}) {
  const { id, request_id, bidder_id, created_at } = filters;
  const conditions = [];

  if (id) conditions.push(eq(request_bids.id, id));
  if (request_id) conditions.push(eq(request_bids.request_id, request_id));
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

export async function insertRequest(data: {
  user_id: string;
  title: string;
  fee?: number;
  status?: RequestStatus;
  description?: string;
  urgency?: Urgency;
}) {
  return await db.insert(requests).values(data);
}

export async function insertRequestBid(data: {
  request_id: string;
  bidder_id: string;
}) {
  return await db.insert(request_bids).values(data);
}

export async function deleteRequest(id: string) {
  return await db.delete(requests).where(eq(requests.id, id));
}

export async function deleteRequestBid(id: string) {
  return await db.delete(request_bids).where(eq(request_bids.id, id));
}

export async function updateRequest(
  id: string,
  data: {
    fee?: number;
    title?: string;
    description?: string;
    status?: RequestStatus;
    urgency?: Urgency;
    completed_at?: Date;
  },
) {
  return await db.update(requests).set(data).where(eq(requests.id, id));
}
