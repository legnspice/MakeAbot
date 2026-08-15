import { and, eq, lte, ilike, gte, desc, lt, ne, inArray } from "drizzle-orm";
import { db } from "../db";
import { offers, offer_bids } from "../db/schema";
import { getDayRange } from "./helper";
import { hasEmptyBatch } from "../batch";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
} from "../validation/offers";

export async function findOfferById(id: string) {
  return await db.query.offers.findFirst({ where: eq(offers.id, id) });
}

/** Most recent offer by this user, ignoring `excludeId` (the one just created). */
export async function findLatestOfferTimestamp(
  userId: string,
  excludeId?: string,
): Promise<Date | null> {
  const row = await db.query.offers.findFirst({
    where: excludeId
      ? and(eq(offers.user_id, userId), ne(offers.id, excludeId))
      : eq(offers.user_id, userId),
    orderBy: [desc(offers.created_at)],
    columns: { created_at: true },
  });
  return row?.created_at ?? null;
}

export async function findOfferBidById(id: string) {
  return await db.query.offer_bids.findFirst({ where: eq(offer_bids.id, id) });
}

export async function findOffers(filters: FindOffersSchema) {
  const { id, user_id, price, title, status, created_at, ids } = filters;
  if (hasEmptyBatch(ids)) return [];
  const conditions = [];
  if (id) conditions.push(eq(offers.id, id));
  if (ids && ids.length > 0) conditions.push(inArray(offers.id, ids));
  if (user_id) conditions.push(eq(offers.user_id, user_id));
  if (price) conditions.push(lte(offers.price, price));
  if (status) conditions.push(eq(offers.status, status));
  if (title) conditions.push(ilike(offers.title, `%${title}%`));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(offers.created_at, startOfDay));
    conditions.push(lte(offers.created_at, endOfDay));
  }
  return await db.query.offers.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(offers.created_at)],
  });
}

export async function findOfferBids(filters: FindOfferBidsSchema) {
  const { id, offer_id, bidder_id, created_at, offer_ids } = filters;
  if (hasEmptyBatch(offer_ids)) return [];
  const conditions = [];
  if (id) conditions.push(eq(offer_bids.id, id));
  if (offer_id) conditions.push(eq(offer_bids.offer_id, offer_id));
  if (offer_ids && offer_ids.length > 0)
    conditions.push(inArray(offer_bids.offer_id, offer_ids));
  if (bidder_id) conditions.push(eq(offer_bids.bidder_id, bidder_id));
  if (created_at) {
    const { startOfDay, endOfDay } = getDayRange(created_at);
    conditions.push(gte(offer_bids.created_at, startOfDay));
    conditions.push(lte(offer_bids.created_at, endOfDay));
  }
  return await db.query.offer_bids.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(offer_bids.created_at)],
  });
}

export async function insertOffer(data: InsertOfferSchema) {
  const [offer] = await db.insert(offers).values(data).returning();
  return offer;
}

export async function insertOfferBid(data: InsertOfferBidSchema) {
  const [bid] = await db.insert(offer_bids).values(data).returning();
  return bid;
}

export async function deleteOffer(id: string, userId: string) {
  return await db
    .delete(offers)
    .where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

export async function deleteOfferBid(id: string, userId: string) {
  return await db
    .delete(offer_bids)
    .where(and(eq(offer_bids.id, id), eq(offer_bids.bidder_id, userId)));
}

export async function updateOffer(
  id: string,
  data: Partial<typeof offers.$inferInsert>,
  userId: string,
) {
  return await db
    .update(offers)
    .set(data)
    .where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

/** Set a single offer_bid status */
export async function updateOfferBidStatus(
  bidId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(offer_bids)
    .set({ status })
    .where(eq(offer_bids.id, bidId));
}

/** Set a single offer_bid to Completed */
export async function completeOfferBid(bidId: string) {
  return await db
    .update(offer_bids)
    .set({ status: "Completed" })
    .where(eq(offer_bids.id, bidId));
}

/** Set all Pending bids on an offer to Closed */
export async function closeOfferBids(offerId: string) {
  return await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(
      and(eq(offer_bids.offer_id, offerId), eq(offer_bids.status, "Pending")),
    );
}

/** Expire Pending offer_bids where parent offer updated_at < 14 days ago */
export async function expireStaleOfferBids(): Promise<
  { bidId: string; bidderId: string; offerTitle: string }[]
> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({
      bidId: offer_bids.id,
      bidderId: offer_bids.bidder_id,
      offerTitle: offers.title,
    })
    .from(offer_bids)
    .innerJoin(offers, eq(offer_bids.offer_id, offers.id))
    .where(
      and(eq(offer_bids.status, "Pending"), lt(offers.updated_at, cutoff)),
    );

  if (stale.length === 0) return [];

  const staleIds = stale.map((r) => r.bidId);
  await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(
      and(eq(offer_bids.status, "Pending"), inArray(offer_bids.id, staleIds)),
    );

  return stale;
}
