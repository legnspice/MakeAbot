import { hasEmptyBatch } from "@/lib/batch";

describe("hasEmptyBatch", () => {
  it("true when any present array is empty", () => {
    expect(hasEmptyBatch([])).toBe(true);
    expect(hasEmptyBatch(["a"], [])).toBe(true);
  });
  it("false when arrays are non-empty or absent", () => {
    expect(hasEmptyBatch(["a"])).toBe(false);
    expect(hasEmptyBatch(undefined)).toBe(false);
    expect(hasEmptyBatch(null)).toBe(false);
    expect(hasEmptyBatch(undefined, ["a"])).toBe(false);
  });
  it("false with no args", () => {
    expect(hasEmptyBatch()).toBe(false);
  });
});
