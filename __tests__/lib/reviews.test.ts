import { oneBidRef } from "@/lib/reviews";

describe("oneBidRef", () => {
  it("returns the offer ref when only offer_bid_id is set", () => {
    expect(oneBidRef({ offer_bid_id: "o1", request_bid_id: null })).toEqual({
      kind: "offer",
      bidId: "o1",
    });
  });
  it("returns the request ref when only request_bid_id is set", () => {
    expect(oneBidRef({ request_bid_id: "r1" })).toEqual({
      kind: "request",
      bidId: "r1",
    });
  });
  it("returns null when neither is set", () => {
    expect(oneBidRef({})).toBeNull();
  });
  it("returns null when both are set", () => {
    expect(oneBidRef({ offer_bid_id: "o1", request_bid_id: "r1" })).toBeNull();
  });
});
