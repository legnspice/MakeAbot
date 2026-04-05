"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/actions/notifications";
import type { SelectNotificationPreferences } from "@/lib/db/schema";

const EVENT_LABELS: Record<
  keyof Omit<SelectNotificationPreferences, "user_id">,
  string
> = {
  new_message: "New messages",
  new_bid: "New bids on your posts/requests",
  bid_accepted: "Your bid was accepted",
  bid_rejected: "Your bid was not accepted",
  new_review: "New reviews",
};

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<SelectNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences().then((result) => {
      setPrefs(result.data ?? null);
      setLoading(false);
    });
  }, []);

  async function handleToggle(key: keyof Omit<SelectNotificationPreferences, "user_id">) {
    if (!prefs) return;
    const newValue = !prefs[key];
    setPrefs({ ...prefs, [key]: newValue });
    setSaving(key);
    await updateNotificationPreferences({ [key]: newValue });
    setSaving(null);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h1>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !prefs ? (
          <p className="text-sm text-gray-400">Could not load preferences.</p>
        ) : (
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {(
              Object.keys(EVENT_LABELS) as Array<
                keyof Omit<SelectNotificationPreferences, "user_id">
              >
            ).map((key) => (
              <div key={key} className="flex items-center justify-between px-1 py-4">
                <span className="text-sm text-gray-800">{EVENT_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => handleToggle(key)}
                  disabled={saving === key}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] ${
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
        )}
      </main>
      <BottomNav />
    </div>
  );
}
