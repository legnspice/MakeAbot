import { matchesTab, isCoalescedType } from "@/lib/notifications-filter";

describe("matchesTab", () => {
  it("All matches everything", () => {
    expect(matchesTab("new_message", "All")).toBe(true);
    expect(matchesTab("bid_expired", "All")).toBe(true);
  });
  it("Messages matches inquiries and messages only", () => {
    expect(matchesTab("new_inquiry", "Messages")).toBe(true);
    expect(matchesTab("new_message", "Messages")).toBe(true);
    expect(matchesTab("new_request", "Messages")).toBe(false);
  });
  it("Activity matches everything that is not a message", () => {
    expect(matchesTab("new_request", "Activity")).toBe(true);
    expect(matchesTab("offer_bid_completed", "Activity")).toBe(true);
    expect(matchesTab("new_message", "Activity")).toBe(false);
    expect(matchesTab("new_inquiry", "Activity")).toBe(false);
  });
  it("groups the newer types under Activity", () => {
    expect(matchesTab("new_offer", "Activity")).toBe(true);
    expect(matchesTab("new_review", "Activity")).toBe(true);
    expect(matchesTab("new_offer", "Messages")).toBe(false);
    expect(matchesTab("new_review", "Messages")).toBe(false);
  });
});

describe("isCoalescedType", () => {
  it("is true for the thread-coalesced types", () => {
    expect(isCoalescedType("new_inquiry")).toBe(true);
    expect(isCoalescedType("new_message")).toBe(true);
  });
  it("is false for one-shot types", () => {
    expect(isCoalescedType("new_request")).toBe(false);
    expect(isCoalescedType("new_offer")).toBe(false);
    expect(isCoalescedType("new_review")).toBe(false);
    expect(isCoalescedType("bid_expired")).toBe(false);
  });
});
