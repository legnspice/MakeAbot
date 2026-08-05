import { db } from "../db";
import { offers, offer_bids, requests, request_bids } from "../db/schema";
import { and, or, eq } from "drizzle-orm";

/** True iff a bid links users a and b in either direction (bidder↔owner), any status. */
export async function relationshipExists(a: string, b: string): Promise<boolean> {
  const offerMatch = await db
    .select({ id: offer_bids.id })
    .from(offer_bids)
    .innerJoin(offers, eq(offer_bids.offer_id, offers.id))
    .where(
      or(
        and(eq(offer_bids.bidder_id, a), eq(offers.user_id, b)),
        and(eq(offer_bids.bidder_id, b), eq(offers.user_id, a)),
      ),
    )
    .limit(1);
  if (offerMatch.length > 0) return true;

  const requestMatch = await db
    .select({ id: request_bids.id })
    .from(request_bids)
    .innerJoin(requests, eq(request_bids.request_id, requests.id))
    .where(
      or(
        and(eq(request_bids.bidder_id, a), eq(requests.user_id, b)),
        and(eq(request_bids.bidder_id, b), eq(requests.user_id, a)),
      ),
    )
    .limit(1);
  return requestMatch.length > 0;
}
