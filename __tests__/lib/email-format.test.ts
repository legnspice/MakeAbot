import { escapeHtml, siteBaseUrl } from "@/lib/email-format";

describe("escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`<a href="x">Tom & "Jerry" 'x'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &quot;Jerry&quot; &#39;x&#39;&lt;/a&gt;",
    );
  });
  it("escapes & first (no double-escaping)", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
  it("leaves plain text and empty string untouched", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
    expect(escapeHtml("")).toBe("");
  });
});

describe("siteBaseUrl", () => {
  const orig = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = orig;
  });
  it("returns the env value without a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://makeabot.app/";
    expect(siteBaseUrl()).toBe("https://makeabot.app");
  });
  it("returns empty string (never 'undefined') when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteBaseUrl()).toBe("");
  });
});
