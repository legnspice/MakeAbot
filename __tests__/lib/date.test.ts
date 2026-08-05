import { timeAgo } from "@/lib/date";

const NOW = new Date("2026-08-05T12:00:00Z");

describe("timeAgo", () => {
  it("returns 'just now' under a minute", () => {
    expect(timeAgo(new Date("2026-08-05T11:59:30Z"), NOW)).toBe("just now");
  });
  it("minutes", () => {
    expect(timeAgo(new Date("2026-08-05T11:45:00Z"), NOW)).toBe("15m ago");
  });
  it("hours", () => {
    expect(timeAgo(new Date("2026-08-05T09:00:00Z"), NOW)).toBe("3h ago");
  });
  it("days", () => {
    expect(timeAgo(new Date("2026-08-03T12:00:00Z"), NOW)).toBe("2d ago");
  });
  it("falls back to a short date beyond 7 days", () => {
    // 2026-07-20 is >7d before NOW → 'Jul 20'
    expect(timeAgo(new Date("2026-07-20T12:00:00Z"), NOW)).toBe("Jul 20");
  });
  it("accepts an ISO string", () => {
    expect(timeAgo("2026-08-05T11:59:30Z", NOW)).toBe("just now");
  });
  it("future or invalid dates clamp to 'just now'", () => {
    expect(timeAgo(new Date("2026-08-05T12:05:00Z"), NOW)).toBe("just now");
  });
});
