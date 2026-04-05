import { NextRequest } from "next/server";
import { GET } from "@/app/auth/confirm/route";

jest.mock("@/lib/supabase/server");
jest.mock("@/lib/supabase/admin");

const { createClient } = jest.requireMock("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock("@/lib/supabase/admin");

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/auth/confirm");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function mockSupabaseClient({
  verifyError = null,
  user = null as object | null,
}: {
  verifyError?: object | null;
  user?: object | null;
}) {
  const mockClient = {
    auth: {
      verifyOtp: jest.fn().mockResolvedValue({ error: verifyError }),
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
      signOut: jest.fn().mockResolvedValue({}),
    },
  };
  createClient.mockResolvedValue(mockClient);
  return mockClient;
}

function mockAdminClient() {
  const mockAdmin = {
    auth: {
      admin: {
        deleteUser: jest.fn().mockResolvedValue({}),
      },
    },
  };
  createAdminClient.mockResolvedValue(mockAdmin);
  return mockAdmin;
}

describe("GET /auth/confirm", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("valid ateneo email", () => {
    it("redirects to / after successful OTP verify", async () => {
      mockSupabaseClient({
        user: { id: "user-123", email: "student@student.ateneo.edu" },
      });

      const response = await GET(
        makeRequest({ token_hash: "valid-hash", type: "email" }),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("does not call deleteUser for valid ateneo emails", async () => {
      mockSupabaseClient({
        user: { id: "user-123", email: "student@student.ateneo.edu" },
      });
      const adminClient = mockAdminClient();

      await GET(makeRequest({ token_hash: "valid-hash", type: "email" }));

      expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe("non-ateneo email", () => {
    it("deletes the user and redirects to the non-ateneo error page", async () => {
      mockSupabaseClient({
        user: { id: "outsider-id", email: "outsider@gmail.com" },
      });
      const adminClient = mockAdminClient();

      const response = await GET(
        makeRequest({ token_hash: "valid-hash", type: "email" }),
      );

      expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        "outsider-id",
      );
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain(
        "non-ateneo-email-used",
      );
    });
  });

  describe("null user after OTP verify", () => {
    it("signs out and redirects to /error", async () => {
      const mockClient = mockSupabaseClient({ user: null });

      const response = await GET(
        makeRequest({ token_hash: "valid-hash", type: "email" }),
      );

      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/error");
    });
  });

  describe("missing or invalid token", () => {
    it("redirects to /error when no token_hash is provided", async () => {
      const response = await GET(makeRequest({ type: "email" }));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/error");
    });

    it("redirects to /error when OTP verify fails", async () => {
      mockSupabaseClient({ verifyError: { message: "Invalid token" } });

      const response = await GET(
        makeRequest({ token_hash: "bad-hash", type: "email" }),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/error");
    });
  });
});
