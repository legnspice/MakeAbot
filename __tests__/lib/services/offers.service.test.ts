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

  it("still returns the bid when the parent touch throws", async () => {
    (offersRepo.findOfferById as jest.Mock).mockRejectedValue(
      new Error("db unavailable"),
    );

    const bid = await offersService.createOfferBid({
      offer_id: "offer-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", offer_id: "offer-1", bidder_id: "bidder-new" });
  });

  it("still returns the bid when the parent update throws", async () => {
    (offersRepo.updateOffer as jest.Mock).mockRejectedValue(
      new Error("db unavailable"),
    );

    const bid = await offersService.createOfferBid({
      offer_id: "offer-1",
      bidder_id: "bidder-new",
    });

    expect(bid).toEqual({ id: "bid-new", offer_id: "offer-1", bidder_id: "bidder-new" });
  });
});

describe("offersService.closeOffer / completeOfferBid ownership", () => {
  beforeEach(() => jest.clearAllMocks());

  it("closeOffer throws when closeOfferAtomic returns false", async () => {
    (offersRepo.closeOfferAtomic as jest.Mock).mockResolvedValue(false);

    await expect(
      offersService.closeOffer("offer-1", "not-the-owner"),
    ).rejects.toThrow("Only the offer owner can close this");
  });

  it("closeOffer does not throw when closeOfferAtomic returns true", async () => {
    (offersRepo.closeOfferAtomic as jest.Mock).mockResolvedValue(true);

    await expect(
      offersService.closeOffer("offer-1", OWNER),
    ).resolves.toBeUndefined();
  });

  it("completeOfferBid forwards (bidId, ownerId) to the scoped repo fn", async () => {
    (offersRepo.completeOfferBidForOwner as jest.Mock).mockResolvedValue(true);

    const result = await offersService.completeOfferBid("bid-1", OWNER);

    expect(offersRepo.completeOfferBidForOwner).toHaveBeenCalledWith(
      "bid-1",
      OWNER,
    );
    expect(result).toBe(true);
  });
});
