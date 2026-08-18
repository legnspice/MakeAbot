import { objectPathFromUrl } from "@/lib/supabase/storage";

const base = "https://abc.supabase.co/storage/v1/object/public";

describe("objectPathFromUrl", () => {
  it("extracts the path from a public bucket URL", () => {
    expect(objectPathFromUrl(`${base}/post_photos/user-1/pic.png`)).toBe(
      "user-1/pic.png",
    );
  });

  it("strips a query string", () => {
    expect(objectPathFromUrl(`${base}/post_photos/a/b.png?token=x`)).toBe(
      "a/b.png",
    );
  });

  it("decodes escaped characters", () => {
    expect(objectPathFromUrl(`${base}/post_photos/my%20pic.png`)).toBe(
      "my pic.png",
    );
  });

  it("returns null for a URL into a different bucket", () => {
    expect(objectPathFromUrl(`${base}/avatars/a.png`)).toBeNull();
  });

  it("returns null for an unrelated URL", () => {
    expect(objectPathFromUrl("https://example.com/a.png")).toBeNull();
  });

  it("returns null when there is no path after the bucket", () => {
    expect(objectPathFromUrl(`${base}/post_photos/`)).toBeNull();
  });
});
