import { matchesTab } from "@/lib/notifications-filter";

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
});
