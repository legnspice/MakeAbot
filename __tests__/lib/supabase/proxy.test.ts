import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

const { createServerClient } = jest.requireMock("@supabase/ssr");

function makeRequest(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`);
}

function mockSupabaseWithUser(user: object | null) {
  createServerClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  });
}

describe("updateSession middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirects unauthenticated users to /auth/login on protected routes", async () => {
    mockSupabaseWithUser(null);

    const response = await updateSession(makeRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/login",
    );
  });

  it("allows unauthenticated access to /auth/* routes", async () => {
    mockSupabaseWithUser(null);

    const response = await updateSession(makeRequest("/auth/login"));

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows authenticated users through on any route", async () => {
    mockSupabaseWithUser({ id: "user-123" });

    const response = await updateSession(makeRequest("/dashboard"));

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows authenticated users to visit /auth/* routes", async () => {
    mockSupabaseWithUser({ id: "user-123" });

    const response = await updateSession(makeRequest("/auth/login"));

    expect(response.status).not.toBe(307);
  });
});
