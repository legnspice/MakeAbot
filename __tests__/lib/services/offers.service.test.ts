import * as offersService from "@/lib/services/offers.service";
import * as offersRepo from "@/lib/repo/offers.repo";

jest.mock("@/lib/repo/offers.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/broadcast.service");

describe("offers.service bid scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("withdrawOfferBid closes the bid through the bidder-scoped repo fn", async () => {
    await offersService.withdrawOfferBid("bid-1", "bidder-1");

    expect(offersRepo.updateOfferBidStatusForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
      "Closed",
    );
    expect(offersRepo.updateOfferBidStatus).not.toHaveBeenCalled();
  });

  it("reopenOfferBid reopens the bid through the bidder-scoped repo fn", async () => {
    await offersService.reopenOfferBid("bid-1", "bidder-1");

    expect(offersRepo.updateOfferBidStatusForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
      "Pending",
    );
    expect(offersRepo.updateOfferBidStatus).not.toHaveBeenCalled();
  });
});
