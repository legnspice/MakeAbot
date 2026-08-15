import type { Urgency } from "./db/enums";

/**
 * Broadcast notifications (new request / new offer) go to every user on the
 * platform, so they are the easiest way to burn the push channel. Policy:
 *
 *  - urgency decides how loud a request is allowed to be
 *  - a poster may only buzz the campus once an hour
 *  - a recipient may only be buzzed by broadcasts N times a day
 *
 * Pure functions only — kept separate from the service layer so the policy is
 * testable without a DB.
 */

/** "push" = OS notification + bell row, "in_app" = bell row only, "none" = feed only. */
export type BroadcastTier = "push" | "in_app" | "none";

/** Max broadcast pushes a single user may receive per calendar day. */
export const RECIPIENT_DAILY_PUSH_CAP = 5;

/** A poster may only trigger one broadcast push per this window. */
export const POSTER_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Urgency is self-declared and costs the poster nothing, so it is only a
 * heuristic — the caps below are what actually bound the channel.
 */
export function requestBroadcastTier(urgency: Urgency): BroadcastTier {
  switch (urgency) {
    case "Now":
    case "Within the hour":
      return "push";
    case "Within the day":
      return "in_app";
    case "Within the week":
    case "Indefinite":
      return "none";
  }
}

/**
 * Offers have no urgency field — supply is browsable, not time-sensitive. They
 * are allowed to push, but the `new_offer` preference defaults to false so in
 * practice they only reach users who opted in.
 */
export function offerBroadcastTier(): BroadcastTier {
  return "push";
}

/**
 * Demote a push-tier broadcast to bell-only when the poster has broadcast
 * within the cooldown window. Non-push tiers are unaffected — the cooldown
 * limits noise, it does not hide posts.
 */
export function applyPosterCooldown(
  tier: BroadcastTier,
  msSincePreviousPost: number | null,
): BroadcastTier {
  if (tier !== "push") return tier;
  if (msSincePreviousPost === null) return tier;
  return msSincePreviousPost < POSTER_COOLDOWN_MS ? "in_app" : tier;
}

/** Recipients already at their daily broadcast-push budget are dropped from the push set. */
export function withinRecipientCap(pushesToday: number): boolean {
  return pushesToday < RECIPIENT_DAILY_PUSH_CAP;
}
