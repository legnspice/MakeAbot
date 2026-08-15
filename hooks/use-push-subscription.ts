"use client";

import { useCallback, useEffect, useState } from "react";

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check actual browser subscription state on mount so the UI reflects reality
  // after a page reload (hook initializes isSubscribed=false by default).
  // If permission was already granted but no worker is registered — a fresh
  // install of the PWA, or a cleared registration — re-register so push keeps
  // working without the user revisiting Settings.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;
    void (async () => {
      let registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (
        !registration &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        registration = await navigator.serviceWorker
          .register("/sw.js")
          .catch(() => undefined);
      }
      const sub = await registration?.pushManager.getSubscription();
      if (sub) setIsSubscribed(true);
    })();
  }, []);

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator))
      return;
    if (Notification.permission === "denied") return; // never re-prompt if denied

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return;

    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      setIsSubscribed(true);
      return;
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      ).buffer as ArrayBuffer,
    });

    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });

    setIsSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    const registration =
      await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    await subscription.unsubscribe();
    setIsSubscribed(false);
  }, []);

  return {
    permission,
    isSubscribed,
    requestPermissionAndSubscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
