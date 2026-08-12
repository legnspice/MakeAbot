import { PRICE_CAP } from "./constants";

/**
 * Soft guard for the free-text incentive: true if the text names a peso amount
 * over the cap (e.g. "₱800", "800 pesos", "php 800"). Bare numbers with no
 * currency indicator are ignored to avoid false positives.
 */
export function incentiveOverCap(text: string | null | undefined): boolean {
  if (!text) return false;
  const re = /(?:₱|php|peso[s]?)\s*(\d{1,7})|(\d{1,7})\s*(?:php|peso[s]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1] ?? m[2], 10);
    if (Number.isFinite(n) && n > PRICE_CAP) return true;
  }
  return false;
}

/** Short display for the incentive slot. */
export function formatIncentive(incentive: string | null | undefined): string {
  const t = incentive?.trim();
  return t && t.length > 0 ? t : "Free";
}
