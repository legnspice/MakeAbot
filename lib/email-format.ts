/** Escape a string for safe interpolation into HTML. Order matters: & first. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Absolute site base URL for email links/assets, without trailing slash.
 *  Empty string when unset — callers must never emit "undefined" into markup. */
export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

/** True only for a base URL a mail client could actually load an image from:
 *  an absolute http(s) URL on a non-loopback host. Guards against a misconfigured
 *  env (empty, or localhost) emitting a broken <img> — callers fall back to a
 *  text wordmark instead. */
export function isEmailSafeBase(base: string): boolean {
  if (!/^https?:\/\//i.test(base)) return false;
  try {
    const host = new URL(base).hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host);
  } catch {
    return false;
  }
}
