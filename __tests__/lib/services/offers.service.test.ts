import * as offersService from "@/lib/services/offers.service";
import * as offersRepo from "@/lib/repo/offers.repo";

jest.mock("@/lib/repo/offers.repo");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/broadcast.service");

describe("offers.service bid scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("withdrawOfferBid closes the bid through the bidder-and-Pending-scoped repo fn", async () => {
    (offersRepo.withdrawOfferBidForBidder as jest.Mock).mockResolvedValue(true);

    await offersService.withdrawOfferBid("bid-1", "bidder-1");

    expect(offersRepo.withdrawOfferBidForBidder).toHaveBeenCalledWith(
      "bid-1",
      "bidder-1",
    );
    expect(offersRepo.updateOfferBidStatus).not.toHaveBeenCalled();
    expect(offersRepo.updateOfferBidStatusForBidder).not.toHaveBeenCalled();
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

  it("fails closed (throws, does not insert) when the parent lookup rejects", async () => {
    // A thrown read means we cannot confirm the offer is still Active, so
    // the guard must not let the bid through — unlike a genuine "not found"
    // (see the "finds nothing" case above), which fails open.
    (offersRepo.findOfferById as jest.Mock).mockRejectedValue(
      new Error("db unavailable"),
    );

    await expect(
      offersService.createOfferBid({
        offer_id: "offer-1",
        bidder_id: "bidder-new",
      }),
    ).rejects.toThrow("Could not verify this offer is still open");

    expect(offersRepo.insertOfferBid).not.toHaveBeenCalled();
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

describe("offersService terminal-state guards", () => {
  beforeEach(() => jest.clearAllMocks());

  it("editOffer throws when the offer is Closed, and does not call the repo update", async () => {
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue({
      ...activeOffer,
      status: "Closed",
    });

    await expect(
      offersService.editOffer("offer-1", { title: "New title" }, OWNER),
    ).rejects.toThrow("This offer is closed and can no longer be edited");

    expect(offersRepo.updateOffer).not.toHaveBeenCalled();
  });

  it("createOfferBid throws when the parent offer is Closed, and does not insert", async () => {
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue({
      ...activeOffer,
      status: "Closed",
    });

    await expect(
      offersService.createOfferBid({
        offer_id: "offer-1",
        bidder_id: "bidder-new",
      }),
    ).rejects.toThrow("This offer is no longer accepting inquiries");

    expect(offersRepo.insertOfferBid).not.toHaveBeenCalled();
  });

  it("reopenOfferBid throws when the parent offer is Closed", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
      id: "bid-1",
      offer_id: "offer-1",
      bidder_id: "bidder-1",
      status: "Closed",
    });
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue({
      ...activeOffer,
      status: "Closed",
    });

    await expect(
      offersService.reopenOfferBid("bid-1", "bidder-1"),
    ).rejects.toThrow("This listing is no longer open");

    expect(offersRepo.updateOfferBidStatusForBidder).not.toHaveBeenCalled();
  });

  it("withdrawOfferBid throws when the scoped repo call reports no row affected", async () => {
    (offersRepo.withdrawOfferBidForBidder as jest.Mock).mockResolvedValue(
      false,
    );

    await expect(
      offersService.withdrawOfferBid("bid-1", "bidder-1"),
    ).rejects.toThrow("This inquiry can no longer be withdrawn");
  });

  it("editOffer throws a 404 (not the terminal-state message) when the offer does not exist", async () => {
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      offersService.editOffer("offer-missing", { title: "New title" }, OWNER),
    ).rejects.toThrow("Offer not found");

    expect(offersRepo.updateOffer).not.toHaveBeenCalled();
  });

  it("reopenOfferBid throws a 404 (not the terminal-state message) when the parent offer does not exist", async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
      id: "bid-1",
      offer_id: "offer-missing",
      bidder_id: "bidder-1",
      status: "Closed",
    });
    (offersRepo.findOfferById as jest.Mock).mockResolvedValue(undefined);

    await expect(
      offersService.reopenOfferBid("bid-1", "bidder-1"),
    ).rejects.toThrow("Offer not found");

    expect(offersRepo.updateOfferBidStatusForBidder).not.toHaveBeenCalled();
  });
});
