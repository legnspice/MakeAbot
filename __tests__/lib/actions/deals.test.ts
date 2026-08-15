import { closeRequest, completeOfferBid, closeOffer, getDealStatus } from "@/lib/actions/deals";
import * as requestsService from "@/lib/services/requests.service";
import * as offersService from "@/lib/services/offers.service";
import * as pushService from "@/lib/services/push.service";
import * as usersService from "@/lib/services/users.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/requests.service");
jest.mock("@/lib/services/offers.service");
jest.mock("@/lib/services/push.service");
jest.mock("@/lib/services/users.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-owner" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("deals actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
    (pushService.sendPushToUser as jest.Mock).mockResolvedValue(undefined);
    (usersService.getUsers as jest.Mock).mockResolvedValue([{ id: "user-owner", name: "Owner User" }]);
  });

  describe("getDealStatus", () => {
    it("returns parentStatus, ownerUserId, and parentId for a request bid", async () => {
      (requestsService.getRequestBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", request_id: "req-1", bidder_id: "bidder-1", status: "Pending" },
      ]);
      (requestsService.getRequests as jest.Mock).mockResolvedValue([
        { id: "req-1", user_id: "user-owner", status: "Active" },
      ]);

      const result = await getDealStatus("bid-1", "request");

      expect(result.data?.parentStatus).toBe("Active");
      expect(result.data?.ownerUserId).toBe("user-owner");
      expect(result.data?.parentId).toBe("req-1");
    });

    it("returns parentStatus, ownerUserId, and parentId for an offer bid", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", offer_id: "offer-1", bidder_id: "bidder-1", status: "Pending" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "user-owner", status: "Active" },
      ]);

      const result = await getDealStatus("bid-1", "offer");

      expect(result.data?.parentStatus).toBe("Active");
      expect(result.data?.ownerUserId).toBe("user-owner");
      expect(result.data?.parentId).toBe("offer-1");
    });

    it("returns error when bid not found", async () => {
      (requestsService.getRequestBids as jest.Mock).mockResolvedValue([]);

      const result = await getDealStatus("bad-bid", "request");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("closeRequest", () => {
    it("closes the request and notifies every conversing bidder", async () => {
      (requestsService.closeRequest as jest.Mock).mockResolvedValue({
        completed: [
          { id: "bid-a", bidder_id: "bidder-a" },
          { id: "bid-b", bidder_id: "bidder-b" },
        ],
        request: { id: "req-1", title: "Need a pen", user_id: "user-owner" },
        finalStatus: "Completed",
      });

      const result = await closeRequest("req-1");

      expect(result.data).toEqual({ success: true });
      expect(requestsService.closeRequest).toHaveBeenCalledWith("req-1", "user-owner");
      expect(pushService.sendPushToUser).toHaveBeenCalledTimes(2);
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-a",
        "request_closed",
        expect.objectContaining({
          title: "Request closed",
          url: expect.stringContaining("bidId=bid-a"),
        }),
      );
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-b",
        "request_closed",
        expect.objectContaining({
          title: "Request closed",
          url: expect.stringContaining("bidId=bid-b"),
        }),
      );
    });

    it("sends nothing when nobody conversed", async () => {
      (requestsService.closeRequest as jest.Mock).mockResolvedValue({
        completed: [],
        request: { id: "req-1", title: "Need a pen", user_id: "user-owner" },
        finalStatus: "Cancelled",
      });

      const result = await closeRequest("req-1");

      expect(result.data).toEqual({ success: true });
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it("surfaces the service's authorization error", async () => {
      const { AppError } = jest.requireActual("@/lib/error/app-error");
      (requestsService.closeRequest as jest.Mock).mockRejectedValue(
        new AppError("Only the requester can close this", 403),
      );

      const result = await closeRequest("req-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Only the requester can close this");
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });
  });

  describe("completeOfferBid", () => {
    it("completes the bid and notifies the bidder", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Pending" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "user-owner", title: "Calculus notes", status: "Active" },
      ]);
      (offersService.completeOfferBid as jest.Mock).mockResolvedValue(true);

      const result = await completeOfferBid("bid-1");

      expect(result.data).toEqual({ success: true });
      expect(offersService.completeOfferBid).toHaveBeenCalledWith(
        "bid-1",
        "user-owner",
      );
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        "bidder-1",
        "offer_bid_completed",
        expect.objectContaining({ title: "Deal confirmed!" }),
      );
    });

    it("rejects a caller who does not own the offer, and dispatches no push", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Pending" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "someone-else", title: "Calculus notes", status: "Active" },
      ]);
      (offersService.completeOfferBid as jest.Mock).mockResolvedValue(false);

      const result = await completeOfferBid("bid-1");

      expect(result.error).toBe("Only the offer owner can mark this done");
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it("rejects a bid that is already completed, and dispatches no push", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Completed" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "user-owner", title: "Calculus notes", status: "Active" },
      ]);
      (offersService.completeOfferBid as jest.Mock).mockResolvedValue(false);

      const result = await completeOfferBid("bid-1");

      expect(result.error).toBe("This deal is already marked done");
      expect(pushService.sendPushToUser).not.toHaveBeenCalled();
    });

    it("checks ownership before disclosing completion state when the scoped write fails", async () => {
      (offersService.getOfferBids as jest.Mock).mockResolvedValue([
        { id: "bid-1", bidder_id: "bidder-1", offer_id: "offer-1", status: "Completed" },
      ]);
      (offersService.getOffers as jest.Mock).mockResolvedValue([
        { id: "offer-1", user_id: "someone-else", title: "Calculus notes", status: "Active" },
      ]);
      (offersService.completeOfferBid as jest.Mock).mockResolvedValue(false);

      const result = await completeOfferBid("bid-1");

      expect(result.error).toBe("Only the offer owner can mark this done");
    });
  });

  describe("closeOffer", () => {
    it("closes the offer as the authenticated user", async () => {
      (offersService.closeOffer as jest.Mock).mockResolvedValue(undefined);

      const result = await closeOffer("offer-1");

      expect(result.data).toEqual({ success: true });
      expect(offersService.closeOffer).toHaveBeenCalledWith("offer-1", "user-owner");
    });

    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await closeOffer("offer-1");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });
});
