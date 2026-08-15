/**
 * iOS only exposes the Web Push API to sites installed to the Home Screen.
 * In a normal Safari tab `Notification` is undefined, so prompting there just
 * fails silently — we show install instructions instead.
 */

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points check disambiguates.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's non-standard flag for Home Screen apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True when push cannot work until the user installs the app first. */
export function needsIosInstall(): boolean {
  return isIos() && !isStandalone() && typeof Notification === "undefined";
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}
