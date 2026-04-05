import {
  createRequest,
  createRequestBid,
  removeRequest,
  removeRequestBid,
  editRequest,
  getRequests,
} from "@/lib/actions/requests";
import * as requestsService from "@/lib/services/requests.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/requests.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("requests actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getRequests({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("createRequest", () => {
    it("overrides user_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(requestsService, "createRequest")
        .mockResolvedValue(undefined as never);

      await createRequest({
        user_id: "attacker-id",
        title: "Help needed",
        urgency: "Now",
        type: "Unknown",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-123" }),
      );
    });
  });

  describe("createRequestBid", () => {
    it("overrides bidder_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(requestsService, "createRequestBid")
        .mockResolvedValue(undefined as never);

      await createRequestBid({
        request_id: "req-123",
        bidder_id: "attacker-id",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ bidder_id: "user-123" }),
      );
    });
  });

  describe("removeRequest", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(requestsService, "removeRequest")
        .mockResolvedValue(undefined as never);

      await removeRequest("req-123");

      expect(mockRemove).toHaveBeenCalledWith("req-123", "user-123");
    });
  });

  describe("removeRequestBid", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(requestsService, "removeRequestBid")
        .mockResolvedValue(undefined as never);

      await removeRequestBid("bid-123");

      expect(mockRemove).toHaveBeenCalledWith("bid-123", "user-123");
    });
  });

  describe("editRequest", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockEdit = jest
        .spyOn(requestsService, "editRequest")
        .mockResolvedValue(undefined as never);

      await editRequest("req-123", { title: "Updated" });

      expect(mockEdit).toHaveBeenCalledWith(
        "req-123",
        expect.any(Object),
        "user-123",
      );
    });
  });
});
