import {
  createOffer,
  createOfferBid,
  removeOffer,
  removeOfferBid,
  editOffer,
  getOffers,
} from "@/lib/actions/offers";
import * as offersService from "@/lib/services/offers.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/offers.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("offers actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getOffers({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("createOffer", () => {
    it("overrides user_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(offersService, "createOffer")
        .mockResolvedValue(undefined as never);

      await createOffer({
        user_id: "attacker-id",
        title: "Test",
        price: null,
        description: null,
        imgUrl: null,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-123" }),
      );
    });

    it("rejects a caller-supplied user_id different from the auth user", async () => {
      const mockCreate = jest
        .spyOn(offersService, "createOffer")
        .mockResolvedValue(undefined as never);

      await createOffer({
        user_id: "other-user-id",
        title: "Test",
        price: null,
        description: null,
        imgUrl: null,
      });

      expect(mockCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "other-user-id" }),
      );
    });
  });

  describe("createOfferBid", () => {
    it("overrides bidder_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(offersService, "createOfferBid")
        .mockResolvedValue(undefined as never);

      await createOfferBid({ post_id: "offer-123", bidder_id: "attacker-id" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ bidder_id: "user-123" }),
      );
    });
  });

  describe("removeOffer", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(offersService, "removeOffer")
        .mockResolvedValue(undefined as never);

      await removeOffer("offer-123");

      expect(mockRemove).toHaveBeenCalledWith("offer-123", "user-123");
    });
  });

  describe("removeOfferBid", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(offersService, "removeOfferBid")
        .mockResolvedValue(undefined as never);

      await removeOfferBid("bid-123");

      expect(mockRemove).toHaveBeenCalledWith("bid-123", "user-123");
    });
  });

  describe("editOffer", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockEdit = jest
        .spyOn(offersService, "editOffer")
        .mockResolvedValue(undefined as never);

      await editOffer("offer-123", { title: "Updated" });

      expect(mockEdit).toHaveBeenCalledWith(
        "offer-123",
        expect.any(Object),
        "user-123",
      );
    });
  });
});
