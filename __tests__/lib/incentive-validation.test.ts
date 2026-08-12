import { insertOfferSchema } from "@/lib/validation/offers";
import { insertRequestSchema } from "@/lib/validation/requests";
import { incentiveOverCap, formatIncentive } from "@/lib/incentive";

const uid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("incentiveOverCap", () => {
  it("flags peso amounts over the cap", () => {
    expect(incentiveOverCap("₱800")).toBe(true);
    expect(incentiveOverCap("800 pesos")).toBe(true);
    expect(incentiveOverCap("php 600")).toBe(true);
  });
  it("allows amounts at or under the cap and non-monetary notes", () => {
    expect(incentiveOverCap("₱500")).toBe(false);
    expect(incentiveOverCap("a coffee")).toBe(false);
    expect(incentiveOverCap("just goodwill")).toBe(false);
    expect(incentiveOverCap(null)).toBe(false);
  });
  it("ignores bare numbers with no currency indicator", () => {
    expect(incentiveOverCap("2 boxes, 3rd floor")).toBe(false);
  });
});

describe("formatIncentive", () => {
  it("returns the text or 'Free'", () => {
    expect(formatIncentive("a coffee")).toBe("a coffee");
    expect(formatIncentive("  ")).toBe("Free");
    expect(formatIncentive(null)).toBe("Free");
  });
});

describe("insert schemas — incentive", () => {
  const offerBase = {
    user_id: uid,
    title: "Charger",
    description: null,
    imgUrl: null,
    status: "Active" as const,
  };
  const reqBase = {
    user_id: uid,
    title: "Umbrella",
    description: null,
    imgUrl: null,
    status: "Active" as const,
    urgency: "Now" as const,
  };

  it("accepts a note and null", () => {
    expect(insertOfferSchema.safeParse({ ...offerBase, incentive: "a coffee" }).success).toBe(true);
    expect(insertOfferSchema.safeParse({ ...offerBase, incentive: null }).success).toBe(true);
    expect(insertRequestSchema.safeParse({ ...reqBase, incentive: "will treat you" }).success).toBe(true);
  });
  it("rejects incentives over the cap", () => {
    expect(insertOfferSchema.safeParse({ ...offerBase, incentive: "₱800" }).success).toBe(false);
    expect(insertRequestSchema.safeParse({ ...reqBase, incentive: "800 pesos" }).success).toBe(false);
  });
  it("rejects incentives longer than 60 chars", () => {
    expect(insertOfferSchema.safeParse({ ...offerBase, incentive: "x".repeat(61) }).success).toBe(false);
  });
});
