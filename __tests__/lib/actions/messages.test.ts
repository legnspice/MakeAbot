import {
  createMessage,
  removeMessage,
  getMessages,
} from "@/lib/actions/messages";
import * as messagesService from "@/lib/services/messages.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/messages.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("messages actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getMessages({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("createMessage", () => {
    it("overrides sender_id with the authenticated user id", async () => {
      const mockCreate = jest
        .spyOn(messagesService, "createMessage")
        .mockResolvedValue(undefined as never);

      await createMessage({
        sender_id: "attacker-id",
        receiver_id: "receiver-123",
        content: "Hello",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ sender_id: "user-123" }),
      );
    });

    it("cannot spoof sender_id from a different user", async () => {
      const mockCreate = jest
        .spyOn(messagesService, "createMessage")
        .mockResolvedValue(undefined as never);

      await createMessage({
        sender_id: "victim-id",
        receiver_id: "receiver-123",
        content: "Impersonation attempt",
      });

      expect(mockCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({ sender_id: "victim-id" }),
      );
    });
  });

  describe("removeMessage", () => {
    it("passes the authenticated user id to the service for ownership enforcement", async () => {
      const mockRemove = jest
        .spyOn(messagesService, "removeMessage")
        .mockResolvedValue(undefined as never);

      await removeMessage("msg-123");

      expect(mockRemove).toHaveBeenCalledWith("msg-123", "user-123");
    });
  });
});
