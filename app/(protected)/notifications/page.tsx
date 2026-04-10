"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GearFill } from "react-bootstrap-icons";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
} from "@/lib/actions/notifications";
import type { SelectNotification } from "@/lib/db/schema";

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const GROUPS: { label: string; types: string[] }[] = [
  { label: "Messages", types: ["new_inquiry", "new_message"] },
  { label: "Reviews", types: ["new_review"] },
  { label: "Opportunities", types: ["new_request"] },
];

function NotificationRow({
  n,
  onClick,
}: {
  n: SelectNotification;
  onClick: (n: SelectNotification) => void;
}) {
  return (
    <button
      key={n.id}
      type="button"
      onClick={() => onClick(n)}
      className={`w-full text-left px-4 py-4 focus:outline-none focus-visible:bg-gray-50 hover:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {!n.is_read && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            )}
            <p className="text-sm font-semibold text-gray-900 leading-snug">
              {n.title}
            </p>
          </div>
          {n.body && (
            <p className="mt-1 text-sm text-gray-600">{n.body}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-500 mt-1">
          {formatTime(new Date(n.created_at))}
        </span>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNotifications().then((result) => {
      if (!cancelled) {
        setNotifications(result.data ?? []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, is_read: true } : item,
        ),
      );
    }
    if (n.url) router.push(n.url);
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-2xl mx-auto w-full px-4 pt-4 pb-28 md:pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-[#3761B0] hover:underline"
              >
                Mark all read
              </button>
            )}
            <Link
              href="/settings/notifications"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <GearFill size={16} />
              Settings
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-center text-gray-400 text-sm pt-10">
            No notifications yet
          </p>
        ) : (
          <div className="space-y-6">
            {GROUPS.map(({ label, types }) => {
              const group = notifications.filter((n) => types.includes(n.type));
              if (group.length === 0) return null;
              return (
                <section key={label} aria-label={label}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 px-1">
                    {label}
                  </h2>
                  <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white">
                    {group.map((n) => (
                      <NotificationRow key={n.id} n={n} onClick={handleClick} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
