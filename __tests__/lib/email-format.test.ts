import { escapeHtml, siteBaseUrl, isEmailSafeBase } from "@/lib/email-format";

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

describe("isEmailSafeBase", () => {
  it("accepts a public http(s) URL", () => {
    expect(isEmailSafeBase("https://makeabot.app")).toBe(true);
    expect(isEmailSafeBase("http://makeabot.app")).toBe(true);
  });
  it("rejects localhost / loopback hosts", () => {
    expect(isEmailSafeBase("http://localhost:3000")).toBe(false);
    expect(isEmailSafeBase("http://127.0.0.1:3000")).toBe(false);
    expect(isEmailSafeBase("http://0.0.0.0")).toBe(false);
  });
  it("rejects empty, non-absolute, or non-http values", () => {
    expect(isEmailSafeBase("")).toBe(false);
    expect(isEmailSafeBase("/relative/path")).toBe(false);
    expect(isEmailSafeBase("makeabot.app")).toBe(false);
    expect(isEmailSafeBase("ftp://makeabot.app")).toBe(false);
  });
});
