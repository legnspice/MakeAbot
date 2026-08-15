import {
  requestBroadcastTier,
  offerBroadcastTier,
  applyPosterCooldown,
  withinRecipientCap,
  POSTER_COOLDOWN_MS,
  RECIPIENT_DAILY_PUSH_CAP,
} from "@/lib/broadcast-policy";

describe("broadcast policy", () => {
  describe("requestBroadcastTier", () => {
    it("pushes for time-critical requests", () => {
      expect(requestBroadcastTier("Now")).toBe("push");
      expect(requestBroadcastTier("Within the hour")).toBe("push");
    });

    it("writes a bell row without pushing for same-day requests", () => {
      expect(requestBroadcastTier("Within the day")).toBe("in_app");
    });

    it("stays out of notifications entirely for non-urgent requests", () => {
      expect(requestBroadcastTier("Within the week")).toBe("none");
      expect(requestBroadcastTier("Indefinite")).toBe("none");
    });
  });

  describe("offerBroadcastTier", () => {
    it("allows push — reach is bounded by the opt-in new_offer preference", () => {
      expect(offerBroadcastTier()).toBe("push");
    });
  });

  describe("applyPosterCooldown", () => {
    it("demotes a push to bell-only inside the cooldown window", () => {
      expect(applyPosterCooldown("push", POSTER_COOLDOWN_MS - 1)).toBe(
        "in_app",
      );
      expect(applyPosterCooldown("push", 0)).toBe("in_app");
    });

    it("allows push once the window has elapsed", () => {
      expect(applyPosterCooldown("push", POSTER_COOLDOWN_MS)).toBe("push");
      expect(applyPosterCooldown("push", POSTER_COOLDOWN_MS + 1)).toBe("push");
    });

    it("allows push when the poster has no previous post", () => {
      expect(applyPosterCooldown("push", null)).toBe("push");
    });

    it("never promotes a lower tier", () => {
      expect(applyPosterCooldown("in_app", POSTER_COOLDOWN_MS + 1)).toBe(
        "in_app",
      );
      expect(applyPosterCooldown("none", null)).toBe("none");
    });
  });

  describe("withinRecipientCap", () => {
    it("admits recipients below the daily cap", () => {
      expect(withinRecipientCap(0)).toBe(true);
      expect(withinRecipientCap(RECIPIENT_DAILY_PUSH_CAP - 1)).toBe(true);
    });

    it("drops recipients at or above the daily cap", () => {
      expect(withinRecipientCap(RECIPIENT_DAILY_PUSH_CAP)).toBe(false);
      expect(withinRecipientCap(RECIPIENT_DAILY_PUSH_CAP + 1)).toBe(false);
    });
  });
});
