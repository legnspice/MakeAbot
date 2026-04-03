import { createReview, removeReview, getReviews } from "@/lib/actions/reviews";
import * as reviewsService from "@/lib/services/reviews.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/reviews.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("reviews actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getReviews({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("createReview", () => {
    it("overrides creator_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(reviewsService, "createReview")
        .mockResolvedValue([] as never);

      await createReview({
        creator_id: "attacker-id",
        rated_user_id: "rated-user-123",
        comment: "Great!",
        rating: 5,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ creator_id: "user-123" }),
      );
    });

    it("cannot spoof creator_id from a different user", async () => {
      const mockCreate = jest
        .spyOn(reviewsService, "createReview")
        .mockResolvedValue([] as never);

      await createReview({
        creator_id: "victim-id",
        rated_user_id: "rated-user-123",
        comment: "Fake review",
        rating: 1,
      });

      expect(mockCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({ creator_id: "victim-id" }),
      );
    });
  });

  describe("removeReview", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(reviewsService, "removeReview")
        .mockResolvedValue(undefined as never);

      await removeReview("review-123");

      expect(mockRemove).toHaveBeenCalledWith("review-123", "user-123");
    });
  });
});
