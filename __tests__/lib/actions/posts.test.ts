import {
  createPost,
  createPostBid,
  removePost,
  removePostBid,
  editPost,
  getPosts,
} from "@/lib/actions/posts";
import * as postsService from "@/lib/services/posts.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/posts.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("posts actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getPosts({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("createPost", () => {
    it("overrides user_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(postsService, "createPost")
        .mockResolvedValue(undefined as never);

      await createPost({
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
        .spyOn(postsService, "createPost")
        .mockResolvedValue(undefined as never);

      await createPost({
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

  describe("createPostBid", () => {
    it("overrides bidder_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(postsService, "createPostBid")
        .mockResolvedValue(undefined as never);

      await createPostBid({ post_id: "post-123", bidder_id: "attacker-id" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ bidder_id: "user-123" }),
      );
    });
  });

  describe("removePost", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(postsService, "removePost")
        .mockResolvedValue(undefined as never);

      await removePost("post-123");

      expect(mockRemove).toHaveBeenCalledWith("post-123", "user-123");
    });
  });

  describe("removePostBid", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(postsService, "removePostBid")
        .mockResolvedValue(undefined as never);

      await removePostBid("bid-123");

      expect(mockRemove).toHaveBeenCalledWith("bid-123", "user-123");
    });
  });

  describe("editPost", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockEdit = jest
        .spyOn(postsService, "editPost")
        .mockResolvedValue(undefined as never);

      await editPost("post-123", { title: "Updated" });

      expect(mockEdit).toHaveBeenCalledWith(
        "post-123",
        expect.any(Object),
        "user-123",
      );
    });
  });
});
