import {
  and,
  eq,
  lte,
  ilike,
  gte,
  desc,
  lt,
  ne,
  inArray,
  exists,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import { offers, offer_bids, messages } from "../db/schema";
import { getDayRange } from "./helper";
import { hasEmptyBatch } from "../batch";
import { notDeleted } from "./soft-delete";
import {
  FindOffersSchema,
  FindOfferBidsSchema,
  InsertOfferBidSchema,
  InsertOfferSchema,
} from "../validation/offers";

export async function findOfferById(id: string) {
  return await db.query.offers.findFirst({
    where: and(eq(offers.id, id), notDeleted(offers)),
  });
}

/** Most recent offer by this user, ignoring `excludeId` (the one just created). */
export async function findLatestOfferTimestamp(
  userId: string,
  excludeId?: string,
): Promise<Date | null> {
  const row = await db.query.offers.findFirst({
    where: excludeId
      ? and(
          eq(offers.user_id, userId),
          ne(offers.id, excludeId),
          notDeleted(offers),
        )
      : and(eq(offers.user_id, userId), notDeleted(offers)),
    orderBy: [desc(offers.created_at)],
    columns: { created_at: true },
  });
  return row?.created_at ?? null;
}

export async function findOfferBidById(id: string) {
  return await db.query.offer_bids.findFirst({
    where: and(eq(offer_bids.id, id), notDeleted(offer_bids)),
  });
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
    where: and(notDeleted(offers), ...conditions),
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
    where: and(notDeleted(offer_bids), ...conditions),
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
    .update(offers)
    .set({ deleted_at: new Date() })
    .where(and(eq(offers.id, id), eq(offers.user_id, userId)));
}

export async function deleteOfferBid(id: string, userId: string) {
  return await db
    .update(offer_bids)
    .set({ deleted_at: new Date() })
    .where(and(eq(offer_bids.id, id), eq(offer_bids.bidder_id, userId)));
}

/**
 * Soft-delete an offer and everything under it, scoped to the owner.
 *
 * Bids are tombstoned, never removed — reviews cascade from them (spec D2), so
 * deleting one here would destroy exactly what soft delete exists to protect.
 * Returns false when the caller does not own the offer, having written nothing.
 */
export async function softDeleteOfferCascade(
  offerId: string,
  ownerId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const now = new Date();

    const owned = await tx
      .update(offers)
      .set({ deleted_at: now })
      .where(
        and(
          eq(offers.id, offerId),
          eq(offers.user_id, ownerId),
          notDeleted(offers),
        ),
      )
      .returning({ id: offers.id });

    if (owned.length === 0) return false;

    const bids = await tx
      .update(offer_bids)
      .set({ deleted_at: now })
      .where(and(eq(offer_bids.offer_id, offerId), notDeleted(offer_bids)))
      .returning({ id: offer_bids.id });

    if (bids.length > 0) {
      await tx
        .update(messages)
        .set({ deleted_at: now })
        .where(
          and(
            inArray(
              messages.offer_bid_id,
              bids.map((b) => b.id),
            ),
            notDeleted(messages),
          ),
        );
    }

    return true;
  });
}

export async function updateOffer(
  id: string,
  data: Partial<typeof offers.$inferInsert>,
  userId: string,
) {
  return await db
    .update(offers)
    .set(data)
    .where(
      and(eq(offers.id, id), eq(offers.user_id, userId), notDeleted(offers)),
    );
}

/**
 * Set a single offer_bid status, unscoped to any owner or bidder.
 *
 * No production caller — this exists only so the service-layer tests can
 * assert `expect(offersRepo.updateOfferBidStatus).not.toHaveBeenCalled()`,
 * guarding against a regression back to an unscoped call. Do not delete it.
 */
export async function updateOfferBidStatus(
  bidId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(offer_bids)
    .set({ status })
    .where(eq(offer_bids.id, bidId));
}

/**
 * Set an offer_bid's status, scoped to its own bidder.
 *
 * The bidder_id predicate is the authorization check: a caller who does not own
 * the bid matches zero rows and transitions nothing.
 */
export async function updateOfferBidStatusForBidder(
  bidId: string,
  bidderId: string,
  status: "Pending" | "Completed" | "Closed",
) {
  return await db
    .update(offer_bids)
    .set({ status })
    .where(
      and(
        eq(offer_bids.id, bidId),
        eq(offer_bids.bidder_id, bidderId),
        notDeleted(offer_bids),
      ),
    );
}

/**
 * Withdraw an offer bid: transitions Pending -> Closed, scoped to its own
 * bidder. Returns false when the caller does not own the bid OR the bid is
 * not Pending — check and write in one statement, so a Completed/Closed bid
 * can never be withdrawn after the fact.
 */
export async function withdrawOfferBidForBidder(
  bidId: string,
  bidderId: string,
): Promise<boolean> {
  const rows = await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(offer_bids.id, bidId),
        eq(offer_bids.bidder_id, bidderId),
        eq(offer_bids.status, "Pending"),
        notDeleted(offer_bids),
      ),
    )
    .returning({ id: offer_bids.id });

  return rows.length > 0;
}

/**
 * Mark an offer bid Completed, scoped to the parent offer's owner and to the
 * bid still being Pending. Returns false when the caller does not own the
 * offer OR the bid has already been completed — check and write in one
 * statement, so concurrent callers cannot both succeed.
 */
export async function completeOfferBidForOwner(
  bidId: string,
  ownerId: string,
): Promise<boolean> {
  const rows = await db
    .update(offer_bids)
    .set({ status: "Completed" })
    .where(
      and(
        eq(offer_bids.id, bidId),
        eq(offer_bids.status, "Pending"),
        notDeleted(offer_bids),
        exists(
          db
            .select({ one: sql`1` })
            .from(offers)
            .where(
              and(
                eq(offers.id, offer_bids.offer_id),
                eq(offers.user_id, ownerId),
                notDeleted(offers),
              ),
            ),
        ),
      ),
    )
    .returning({ id: offer_bids.id });

  return rows.length > 0;
}

/**
 * Close a pending offer bid without completing it, scoped to the parent
 * offer's owner. Check and write in one statement. Returns false when the
 * caller does not own the offer or the bid is no longer Pending.
 */
export async function dismissOfferBidForOwner(
  bidId: string,
  ownerId: string,
): Promise<boolean> {
  const rows = await db
    .update(offer_bids)
    .set({ status: "Closed" })
    .where(
      and(
        eq(offer_bids.id, bidId),
        eq(offer_bids.status, "Pending"),
        notDeleted(offer_bids),
        exists(
          db
            .select({ one: sql`1` })
            .from(offers)
            .where(
              and(
                eq(offers.id, offer_bids.offer_id),
                eq(offers.user_id, ownerId),
                notDeleted(offers),
              ),
            ),
        ),
      ),
    )
    .returning({ id: offer_bids.id });

  return rows.length > 0;
}

/**
 * Close an offer and all its Pending bids, in one transaction, scoped to the
 * owner. Returns `{ closed: false, affected: [] }` when the caller does not
 * own the offer, in which case nothing is written — the bid close must never
 * run on an unowned offer. Otherwise returns the bids that were closed, so
 * callers can notify their bidders.
 */
export async function closeOfferAtomic(
  offerId: string,
  ownerId: string,
): Promise<{ closed: boolean; affected: { id: string; bidder_id: string }[] }> {
  return await db.transaction(async (tx) => {
    const owned = await tx
      .update(offers)
      .set({ status: "Closed" })
      .where(
        and(
          eq(offers.id, offerId),
          eq(offers.user_id, ownerId),
          notDeleted(offers),
        ),
      )
      .returning({ id: offers.id });

    if (owned.length === 0) return { closed: false, affected: [] };

    const affected = await tx
      .update(offer_bids)
      .set({ status: "Closed" })
      .where(
        and(
          eq(offer_bids.offer_id, offerId),
          eq(offer_bids.status, "Pending"),
          notDeleted(offer_bids),
        ),
      )
      .returning({ id: offer_bids.id, bidder_id: offer_bids.bidder_id });

    return { closed: true, affected };
  });
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
      and(
        eq(offer_bids.status, "Pending"),
        lt(offers.updated_at, cutoff),
        notDeleted(offers),
        notDeleted(offer_bids),
      ),
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
