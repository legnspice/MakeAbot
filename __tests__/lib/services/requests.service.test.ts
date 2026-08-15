import * as requestsService from "@/lib/services/requests.service";
import * as requestsRepo from "@/lib/repo/requests.repo";

jest.mock("@/lib/repo/requests.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/broadcast.service");

describe("requests.service bid scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("withdrawRequestBid closes the bid through the bidder-scoped repo fn", async () => {
    await requestsService.withdrawRequestBid("bid-1", "bidder-1");

    expect(requestsRepo.updateRequestBidStatusForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
      "Closed",
    );
    expect(requestsRepo.updateRequestBidStatus).not.toHaveBeenCalled();
  });

  it("reopenRequestBid reopens the bid through the bidder-scoped repo fn", async () => {
    await requestsService.reopenRequestBid("bid-1", "bidder-1");

    expect(requestsRepo.updateRequestBidStatusForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
      "Pending",
    );
    expect(requestsRepo.updateRequestBidStatus).not.toHaveBeenCalled();
  });
});
