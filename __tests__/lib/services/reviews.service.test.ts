import { reviewEligibility, createReview } from "@/lib/services/reviews.service";
import * as reviewsRepo from "@/lib/repo/reviews.repo";
import * as offersRepo from "@/lib/repo/offers.repo";
import * as requestsRepo from "@/lib/repo/requests.repo";

jest.mock("@/lib/repo/reviews.repo");
jest.mock("@/lib/repo/offers.repo");
jest.mock("@/lib/repo/requests.repo");
jest.mock("@/lib/repo/users.repo");
jest.mock("@/lib/services/push.service");

const OWNER = "owner-1";
const BIDDER = "bidder-1";

function mockOfferDeal(status: string) {
  (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue({
    id: "bid-1",
    offer_id: "offer-1",
    bidder_id: BIDDER,
    status,
  });
  (offersRepo.findOfferById as jest.Mock).mockResolvedValue({
    id: "offer-1",
    user_id: OWNER,
  });
}

function mockRequestDeal(status: string) {
  (requestsRepo.findRequestBidById as jest.Mock).mockResolvedValue({
    id: "bid-1",
    request_id: "req-1",
    bidder_id: BIDDER,
    status,
  });
  (requestsRepo.findRequestById as jest.Mock).mockResolvedValue({
    id: "req-1",
    user_id: OWNER,
  });
}

describe("reviewEligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reviewsRepo.findReviewByCreatorAndBid as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it("is ok for a party on a Completed offer bid with no prior review", async () => {
    mockOfferDeal("Completed");

    await expect(reviewEligibility("bid-1", "offer", OWNER)).resolves.toEqual({
      ok: true,
    });
    await expect(reviewEligibility("bid-1", "offer", BIDDER)).resolves.toEqual({
      ok: true,
    });
  });

  it("is ok for a party on a Completed request bid", async () => {
    mockRequestDeal("Completed");

    await expect(
      reviewEligibility("bid-1", "request", BIDDER),
    ).resolves.toEqual({ ok: true });
  });

  it('refuses with "not-found" when the bid does not exist', async () => {
    (offersRepo.findOfferBidById as jest.Mock).mockResolvedValue(undefined);

    await expect(reviewEligibility("nope", "offer", OWNER)).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it('refuses with "not-completed" for a Pending bid', async () => {
    mockOfferDeal("Pending");

    await expect(reviewEligibility("bid-1", "offer", OWNER)).resolves.toEqual({
      ok: false,
      reason: "not-completed",
    });
  });

  it('refuses with "not-completed" for a Closed bid', async () => {
    mockRequestDeal("Closed");

    await expect(
      reviewEligibility("bid-1", "request", OWNER),
    ).resolves.toEqual({ ok: false, reason: "not-completed" });
  });

  it('refuses with "not-a-party" for a stranger', async () => {
    mockOfferDeal("Completed");

    await expect(
      reviewEligibility("bid-1", "offer", "stranger-9"),
    ).resolves.toEqual({ ok: false, reason: "not-a-party" });
  });

  it('refuses with "already-reviewed" when this user already reviewed the bid', async () => {
    mockOfferDeal("Completed");
    (reviewsRepo.findReviewByCreatorAndBid as jest.Mock).mockResolvedValue({
      id: "review-1",
    });

    await expect(reviewEligibility("bid-1", "offer", OWNER)).resolves.toEqual({
      ok: false,
      reason: "already-reviewed",
    });
  });
});

describe("createReview goes through reviewEligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reviewsRepo.findReviewByCreatorAndBid as jest.Mock).mockResolvedValue(
      undefined,
    );
    (reviewsRepo.insertReview as jest.Mock).mockResolvedValue([{ id: "r-1" }]);
  });

  it("inserts when eligible", async () => {
    mockOfferDeal("Completed");

    await createReview({
      creator_id: OWNER,
      rated_user_id: BIDDER,
      rating: 5,
      offer_bid_id: "bid-1",
    } as never);

    expect(reviewsRepo.insertReview).toHaveBeenCalled();
  });

  it("maps not-completed to the completed-deal message", async () => {
    mockOfferDeal("Pending");

    await expect(
      createReview({
        creator_id: OWNER,
        rated_user_id: BIDDER,
        rating: 5,
        offer_bid_id: "bid-1",
      } as never),
    ).rejects.toThrow("You can only review a completed deal you were part of.");
    expect(reviewsRepo.insertReview).not.toHaveBeenCalled();
  });

  it("maps not-a-party to the completed-deal message", async () => {
    mockOfferDeal("Completed");

    await expect(
      createReview({
        creator_id: "stranger-9",
        rated_user_id: BIDDER,
        rating: 5,
        offer_bid_id: "bid-1",
      } as never),
    ).rejects.toThrow("You can only review a completed deal you were part of.");
  });

  it("maps already-reviewed to its own message", async () => {
    mockOfferDeal("Completed");
    (reviewsRepo.findReviewByCreatorAndBid as jest.Mock).mockResolvedValue({
      id: "review-1",
    });

    await expect(
      createReview({
        creator_id: OWNER,
        rated_user_id: BIDDER,
        rating: 5,
        offer_bid_id: "bid-1",
      } as never),
    ).rejects.toThrow("You've already reviewed this deal.");
  });

  it("still rejects a rated user who is not the counterparty", async () => {
    mockOfferDeal("Completed");

    await expect(
      createReview({
        creator_id: OWNER,
        rated_user_id: "stranger-9",
        rating: 5,
        offer_bid_id: "bid-1",
      } as never),
    ).rejects.toThrow("You can only review a completed deal you were part of.");
  });
});
