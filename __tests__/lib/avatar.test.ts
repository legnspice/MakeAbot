import { resolveMetaAvatar, avatarNeedsSync } from "@/lib/avatar";

describe("resolveMetaAvatar", () => {
  it("prefers avatar_url over picture", () => {
    expect(resolveMetaAvatar({ avatar_url: "a", picture: "p" })).toBe("a");
  });
  it("falls back to picture", () => {
    expect(resolveMetaAvatar({ picture: "p" })).toBe("p");
  });
  it("returns null when neither present", () => {
    expect(resolveMetaAvatar({})).toBeNull();
    expect(resolveMetaAvatar(undefined)).toBeNull();
  });
  it("returns null for empty-string or non-string values", () => {
    expect(resolveMetaAvatar({ avatar_url: "" })).toBeNull();
    expect(resolveMetaAvatar({ avatar_url: 123 } as never)).toBeNull();
    expect(resolveMetaAvatar({ avatar_url: "", picture: "p" })).toBe("p");
  });
});

describe("avatarNeedsSync", () => {
  it("true when stored differs from next", () => {
    expect(avatarNeedsSync(null, "a")).toBe(true);
    expect(avatarNeedsSync("old", "new")).toBe(true);
  });
  it("false when equal (including both null)", () => {
    expect(avatarNeedsSync("a", "a")).toBe(false);
    expect(avatarNeedsSync(null, null)).toBe(false);
  });
  it("treats undefined stored the same as null", () => {
    expect(avatarNeedsSync(undefined, null)).toBe(false);
    expect(avatarNeedsSync(undefined, "a")).toBe(true);
  });
});
