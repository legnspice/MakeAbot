import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notifications";
import * as notificationsService from "@/lib/services/notifications.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/notifications.service");
jest.mock("@/lib/actions/auth");

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("notifications actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated getNotifications", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));
      const result = await getNotifications();
      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("getNotifications", () => {
    it("fetches notifications for the authenticated user", async () => {
      const mockGet = jest
        .spyOn(notificationsService, "getNotificationsForUser")
        .mockResolvedValue([] as never);
      await getNotifications();
      expect(mockGet).toHaveBeenCalledWith("user-123");
    });
  });

  describe("markNotificationRead", () => {
    it("marks a notification read for the authenticated user", async () => {
      const mockMark = jest
        .spyOn(notificationsService, "markRead")
        .mockResolvedValue(undefined as never);
      await markNotificationRead("notif-abc");
      expect(mockMark).toHaveBeenCalledWith("notif-abc", "user-123");
    });
  });

  describe("updateNotificationPreferences", () => {
    it("cannot update preferences for another user — always uses auth user id", async () => {
      const mockUpdate = jest
        .spyOn(notificationsService, "updatePreferences")
        .mockResolvedValue(undefined as never);
      await updateNotificationPreferences({ new_message: false });
      expect(mockUpdate).toHaveBeenCalledWith("user-123", { new_message: false });
    });

    it("passes remaining valid preference fields through to service", async () => {
      // These fields should no longer exist in the schema — updatePreferencesSchema
      // should silently strip or not validate them. We verify the action only passes
      // the remaining valid fields to the service.
      const mockUpdate = jest
        .spyOn(notificationsService, "updatePreferences")
        .mockResolvedValue(undefined as never);

      // Passing only a valid field — should work fine
      await updateNotificationPreferences({ new_review: true });
      expect(mockUpdate).toHaveBeenCalledWith("user-123", { new_review: true });
    });
  });
});
