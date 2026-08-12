import { buildUnreadMap, sumUnreadForBids } from "@/lib/unread";

describe("buildUnreadMap", () => {
  it("sums message_count per context_id and skips null", () => {
    const map = buildUnreadMap([
      { context_id: "a", message_count: 2 },
      { context_id: "a", message_count: 3 },
      { context_id: "b", message_count: 1 },
      { context_id: null, message_count: 9 },
    ]);
    expect(map).toEqual({ a: 5, b: 1 });
  });

  it("returns an empty map for no rows", () => {
    expect(buildUnreadMap([])).toEqual({});
  });
});

describe("sumUnreadForBids", () => {
  const map = { a: 5, b: 1, c: 4 };
  it("sums map values for the given bid ids, missing = 0", () => {
    expect(sumUnreadForBids(map, ["a", "c", "zzz"])).toBe(9);
  });
  it("returns 0 when no ids match", () => {
    expect(sumUnreadForBids(map, ["x", "y"])).toBe(0);
  });
});
