import { editUser, getUsers } from "@/lib/actions/users";
import * as usersService from "@/lib/services/users.service";
import * as authModule from "@/lib/actions/auth";

jest.mock("@/lib/services/users.service");
jest.mock("@/lib/actions/auth");
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: { getUser: jest.fn() },
  }),
}));

const mockUser = { id: "user-123" };
const mockRequireAuth = authModule.requireAuth as jest.Mock;

describe("users actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(mockUser);
  });

  describe("authentication guard", () => {
    it("returns error for unauthenticated calls", async () => {
      mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

      const result = await getUsers({});

      expect(result.data).toBeNull();
      expect(result.error).toBe("Something went wrong");
    });
  });

  describe("editUser", () => {
    it("allows a user to edit their own profile", async () => {
      jest
        .spyOn(usersService, "editUser")
        .mockResolvedValue(undefined as never);

      const result = await editUser("user-123", { name: "Updated Name" });

      expect(result.error).toBeNull();
    });

    it("returns Forbidden when trying to edit another user's profile", async () => {
      const result = await editUser("other-user-id", { name: "Hacked" });

      expect(result.data).toBeNull();
      expect(result.error).toBe("Forbidden");
    });

    it("does not call the service when the ownership check fails", async () => {
      const mockEdit = jest.spyOn(usersService, "editUser");

      await editUser("other-user-id", { name: "Hacked" });

      expect(mockEdit).not.toHaveBeenCalled();
    });
  });
});
