import {
  and,
  eq,
  lte,
  ilike,
  gte,
  desc,
  ne,
  lt,
  inArray,
  exists,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import { requests, request_bids, messages } from "../db/schema";
import { getDayRange } from "./helper";
import { hasEmptyBatch } from "../batch";
import { notDeleted } from "./soft-delete";
import {
  FindRequestsSchema,
  FindRequestBidsSchema,
  InsertRequestBidSchema,
  InsertRequestSchema,
} from "@/lib/validation/requests";

export async function findRequestById(id: string) {
  return await db.query.requests.findFirst({
    where: and(eq(requests.id, id), notDeleted(requests)),
  });
}

/** Most recent request by this user, ignoring `excludeId` (the one just created). */
export async function findLatestRequestTimestamp(
  userId: string,
  excludeId?: string,
): Promise<Date | null> {
  const row = await db.query.requests.findFirst({
    where: excludeId
      ? and(
          eq(requests.user_id, userId),
          ne(requests.id, excludeId),
          notDeleted(requests),
        )
      : and(eq(requests.user_id, userId), notDeleted(requests)),
    orderBy: [desc(requests.created_at)],
    columns: { created_at: true },
  });
  return row?.created_at ?? null;
}

export async function findRequestBidById(id: string) {
  return await db.query.request_bids.findFirst({
    where: and(eq(request_bids.id, id), notDeleted(request_bids)),
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
    where: and(notDeleted(requests), ...conditions),
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
    where: and(notDeleted(request_bids), ...conditions),
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
    .update(requests)
    .set({ deleted_at: new Date() })
    .where(and(eq(requests.id, id), eq(requests.user_id, userId)));
}

export async function deleteRequestBid(id: string, userId: string) {
  return await db
    .update(request_bids)
    .set({ deleted_at: new Date() })
    .where(and(eq(request_bids.id, id), eq(request_bids.bidder_id, userId)));
}

/**
 * Soft-delete a request and everything under it, scoped to the owner.
 *
 * Bids are tombstoned, never removed — reviews cascade from them (spec D2), so
 * deleting one here would destroy exactly what soft delete exists to protect.
 * Returns false when the caller does not own the request, having written nothing.
 */
export async function softDeleteRequestCascade(
  requestId: string,
  ownerId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const now = new Date();

    const owned = await tx
      .update(requests)
      .set({ deleted_at: now })
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.user_id, ownerId),
          notDeleted(requests),
        ),
      )
      .returning({ id: requests.id });

    if (owned.length === 0) return false;

    const bids = await tx
      .update(request_bids)
      .set({ deleted_at: now })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          notDeleted(request_bids),
        ),
      )
      .returning({ id: request_bids.id });

    if (bids.length > 0) {
      await tx
        .update(messages)
        .set({ deleted_at: now })
        .where(
          and(
            inArray(
              messages.request_bid_id,
              bids.map((b) => b.id),
            ),
            notDeleted(messages),
          ),
        );
    }

    return true;
  });
}

export async function updateRequest(
  id: string,
  data: Partial<typeof requests.$inferInsert>,
  userId: string,
) {
  return await db
    .update(requests)
    .set(data)
    .where(
      and(
        eq(requests.id, id),
        eq(requests.user_id, userId),
        notDeleted(requests),
      ),
    );
}

/**
 * Set a single request_bid status, unscoped to any owner or bidder.
 *
 * No production caller — this exists only so the service-layer tests can
 * assert `expect(requestsRepo.updateRequestBidStatus).not.toHaveBeenCalled()`,
 * guarding against a regression back to an unscoped call. Do not delete it.
 */
export async function updateRequestBidStatus(
  bidId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(eq(request_bids.id, bidId));
}

/**
 * Set a request_bid's status, scoped to its own bidder.
 *
 * The bidder_id predicate is the authorization check: a caller who does not own
 * the bid matches zero rows and transitions nothing.
 */
export async function updateRequestBidStatusForBidder(
  bidId: string,
  bidderId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(request_bids)
    .set({ status })
    .where(
      and(
        eq(request_bids.id, bidId),
        eq(request_bids.bidder_id, bidderId),
        notDeleted(request_bids),
      ),
    );
}

/**
 * Withdraw a request bid: transitions Pending -> Closed, scoped to its own
 * bidder. Returns false when the caller does not own the bid OR the bid is
 * not Pending — check and write in one statement, so a Completed/Closed bid
 * can never be withdrawn after the fact.
 */
export async function withdrawRequestBidForBidder(
  bidId: string,
  bidderId: string,
): Promise<boolean> {
  const rows = await db
    .update(request_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(request_bids.id, bidId),
        eq(request_bids.bidder_id, bidderId),
        eq(request_bids.status, "Pending"),
        notDeleted(request_bids),
      ),
    )
    .returning({ id: request_bids.id });

  return rows.length > 0;
}

/**
 * Close a request and resolve every bid on it, in one transaction, scoped to
 * the owner.
 *
 * Pending bids that have at least one message become Completed — that is the
 * notify-and-review set. Whatever remains Pending had no conversation and
 * becomes Closed, which is why the second statement needs no message
 * predicate: the first already claimed everything that qualified. Doing the
 * message check in SQL keeps it inside the transaction, so a message arriving
 * mid-close cannot produce an inconsistent result.
 *
 * Bids the bidder withdrew earlier are already Closed and are therefore
 * untouched and unreported, which is what keeps the notification set honest.
 *
 * Returns finalStatus null and writes nothing when the caller does not own the
 * request.
 */
export async function closeRequestAtomic(
  requestId: string,
  ownerId: string,
): Promise<{
  completed: { id: string; bidder_id: string }[];
  silent: { id: string; bidder_id: string }[];
  finalStatus: "Completed" | "Cancelled" | null;
}> {
  return await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          eq(requests.id, requestId),
          eq(requests.user_id, ownerId),
          eq(requests.status, "Active"),
          notDeleted(requests),
        ),
      );

    if (owned.length === 0)
      return { completed: [], silent: [], finalStatus: null };

    const completed = await tx
      .update(request_bids)
      .set({ status: "Completed" })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          eq(request_bids.status, "Pending"),
          notDeleted(request_bids),
          exists(
            tx
              .select({ one: sql`1` })
              .from(messages)
              // Correlated on the OUTER request_bids.id — do not replace with a
              // literal id, or every silent bid would complete.
              .where(
                and(
                  eq(messages.request_bid_id, request_bids.id),
                  notDeleted(messages),
                ),
              ),
          ),
        ),
      )
      .returning({ id: request_bids.id, bidder_id: request_bids.bidder_id });

    const silent = await tx
      .update(request_bids)
      .set({ status: "Closed" })
      .where(
        and(
          eq(request_bids.request_id, requestId),
          eq(request_bids.status, "Pending"),
          notDeleted(request_bids),
        ),
      )
      .returning({ id: request_bids.id, bidder_id: request_bids.bidder_id });

    const finalStatus = completed.length > 0 ? "Completed" : "Cancelled";

    await tx
      .update(requests)
      .set({
        status: finalStatus,
        ...(finalStatus === "Completed" ? { completed_at: new Date() } : {}),
      })
      .where(and(eq(requests.id, requestId), eq(requests.user_id, ownerId)));

    return { completed, silent, finalStatus };
  });
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
      and(
        eq(request_bids.status, "Pending"),
        lt(requests.updated_at, cutoff),
        notDeleted(requests),
        notDeleted(request_bids),
      ),
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
