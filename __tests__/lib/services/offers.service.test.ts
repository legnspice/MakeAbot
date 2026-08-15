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

const OWNER = "user-owner";
const activeOffer = {
  id: "offer-1",
  user_id: OWNER,
  title: "Tutoring session",
  status: "Active",
};

describe("offersService.createOfferBid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (offersRepo.insertOfferBid as jest.Mock).mockResolvedValue({
      id: "bid-new",
      offer_id: "offer-1",
      bidder_id: "bidder-new",
    });
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue(activeOffer);
  });

  it("touches the parent offer so the expiry clock resets", async () => {
    await offersService.createOfferBid({
      offer_id: "offer-1",
      bidder_id: "bidder-new",
    });

    expect(offersRepo.updateOffer).toHaveBeenCalledWith(
      "offer-1",
      { updated_at: expect.any(Date) },
      OWNER,
    );
  });

  it("still returns the bid when the parent lookup finds nothing", async () => {
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue(undefined);

    const bid = await offersService.createOfferBid({
      offer_id: "offer-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", offer_id: "offer-1", bidder_id: "bidder-new" });
    expect(offersRepo.updateOffer).not.toHaveBeenCalled();
  });
});
