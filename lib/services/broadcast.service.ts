import * as offersRepo from "../repo/offers.repo";
import * as requestsRepo from "../repo/requests.repo";
import { applyPosterCooldown, type BroadcastTier } from "../broadcast-policy";

/**
 * Apply the per-poster cooldown to a broadcast tier. The window spans requests
 * AND offers — the limit is "how often may one person buzz the campus", not
 * "per post type".
 */
export async function tierAfterPosterCooldown(
  tier: BroadcastTier,
  userId: string,
  exclude: { requestId?: string; offerId?: string },
): Promise<BroadcastTier> {
  if (tier !== "push") return tier;

  const [lastRequest, lastOffer] = await Promise.all([
    requestsRepo.findLatestRequestTimestamp(userId, exclude.requestId),
    offersRepo.findLatestOfferTimestamp(userId, exclude.offerId),
  ]);

  const timestamps = [lastRequest, lastOffer].filter(
    (d): d is Date => d instanceof Date,
  );
  if (timestamps.length === 0) return applyPosterCooldown(tier, null);

  const mostRecent = Math.max(...timestamps.map((d) => d.getTime()));
  return applyPosterCooldown(tier, Date.now() - mostRecent);
}
