"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getNotifications();
    setNotifications(result.data ?? []);
    setLoading(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      load();
    }
  }, [open, loaded, load]);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id ? { ...item, is_read: true } : item,
        ),
      );
    }
    if (n.url) {
      router.push(n.url);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-100 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
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
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Close notifications"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">
              No notifications yet
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
                >
                  {!n.is_read && (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 mb-0.5" />
                  )}
                  <p className="text-sm font-semibold text-gray-900 leading-snug inline">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {formatTime(new Date(n.created_at))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
