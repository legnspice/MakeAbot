import { insertOfferSchema } from "@/lib/validation/offers";
import { insertRequestSchema } from "@/lib/validation/requests";
import { PRICE_CAP } from "@/lib/constants";

const uid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("insertOfferSchema incentive + cap", () => {
  const base = {
    user_id: uid,
    title: "Charger",
    description: null,
    imgUrl: null,
    status: "Active" as const,
  };
  it("accepts a valid ₱ amount and incentive text", () => {
    expect(
      insertOfferSchema.safeParse({ ...base, price: 100, incentive: "a coffee" })
        .success,
    ).toBe(true);
  });
  it("rejects a price above the cap", () => {
    expect(
      insertOfferSchema.safeParse({ ...base, price: PRICE_CAP + 1, incentive: null })
        .success,
    ).toBe(false);
  });
  it("accepts null price and null incentive", () => {
    expect(
      insertOfferSchema.safeParse({ ...base, price: null, incentive: null })
        .success,
    ).toBe(true);
  });
  it("rejects an incentive longer than 60 chars", () => {
    expect(
      insertOfferSchema.safeParse({
        ...base,
        price: null,
        incentive: "x".repeat(61),
      }).success,
    ).toBe(false);
  });
});

describe("insertRequestSchema incentive + cap", () => {
  const base = {
    user_id: uid,
    title: "Umbrella",
    description: null,
    imgUrl: null,
    status: "Active" as const,
    urgency: "Now" as const,
  };
  it("accepts a valid ₱ amount and incentive text", () => {
    expect(
      insertRequestSchema.safeParse({
        ...base,
        fee: 50,
        incentive: "will treat you",
      }).success,
    ).toBe(true);
  });
  it("rejects a fee above the cap", () => {
    expect(
      insertRequestSchema.safeParse({ ...base, fee: PRICE_CAP + 1, incentive: null })
        .success,
    ).toBe(false);
  });
});
