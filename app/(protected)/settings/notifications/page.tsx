"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notifications";
import type { SelectNotificationPreferences } from "@/lib/db/schema";
import { usePushSubscription } from "@/hooks/use-push-subscription";

type PrefKey = keyof Omit<SelectNotificationPreferences, "user_id">;

const EVENT_LABELS: Record<PrefKey, string> = {
  new_inquiry: "New inquiries on my posts",
  new_message: "New messages in active conversations",
  new_request: "New requests from others",
  new_offer: "New offers from others",
  email_digest: "Daily email summary of unread conversations",
};

const EVENT_HINTS: Partial<Record<PrefKey, string>> = {
  new_request: "Only urgent requests notify you.",
  new_offer: "Off by default — offers are browsable in the feed.",
};

const IN_APP_KEYS: PrefKey[] = [
  "new_inquiry",
  "new_message",
  "new_request",
  "new_offer",
];
const EMAIL_KEYS: PrefKey[] = ["email_digest"];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SelectNotificationPreferences | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const {
    permission,
    isSubscribed,
    requestPermissionAndSubscribe,
    unsubscribe,
  } = usePushSubscription();

  useEffect(() => {
    getNotificationPreferences().then((result) => {
      setPrefs(result.data ?? null);
      setLoading(false);
    });
  }, []);

  async function handleToggle(key: PrefKey) {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    setSaving(key);
    await updateNotificationPreferences({ [key]: newValue });
    setSaving(null);
  }

  function renderSection(heading: string, keys: PrefKey[]) {
    if (!prefs) return null;
    return (
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {heading}
        </h2>
        <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
          {keys.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 px-1 py-4"
            >
              <span className="min-w-0">
                <span className="block text-sm text-gray-800">
                  {EVENT_LABELS[key]}
                </span>
                {EVENT_HINTS[key] && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {EVENT_HINTS[key]}
                  </span>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                aria-label={EVENT_LABELS[key]}
                onClick={() => handleToggle(key)}
                disabled={saving === key}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] ${
                  prefs[key] ? "bg-[#3761B0]" : "bg-gray-300"
                } ${saving === key ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    prefs[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">
          Notification Settings
        </h1>

        {/* Push notification subscribe/unsubscribe */}
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-gray-50">
          <p className="text-sm font-medium text-gray-900 mb-1">
            Browser push notifications
          </p>
          {permission === "denied" ? (
            <p className="text-xs text-gray-500">
              Push notifications are blocked in your browser settings.
            </p>
          ) : isSubscribed ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Push notifications are enabled on this device.
              </p>
              <button
                type="button"
                onClick={unsubscribe}
                className="text-xs text-red-500 hover:underline ml-4"
              >
                Disable
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Get notified even when the app is closed.
              </p>
              <button
                type="button"
                onClick={requestPermissionAndSubscribe}
                className="text-xs text-[#3761B0] hover:underline ml-4"
              >
                Enable
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !prefs ? (
          <p className="text-sm text-gray-400">Could not load preferences.</p>
        ) : (
          <>
            {renderSection("In-app & push", IN_APP_KEYS)}
            {renderSection("Email", EMAIL_KEYS)}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
