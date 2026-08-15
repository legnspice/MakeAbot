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
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import NotificationFilter from "@/components/ui/notification-filter";
import {
  type NotifTab,
  matchesTab,
  isCoalescedType,
} from "@/lib/notifications-filter";

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

/** Read notifications collapse past this many, matching the desktop panel. */
const READ_THRESHOLD = 3;

function NotificationRow({
  n,
  onClick,
}: {
  n: SelectNotification;
  onClick: (n: SelectNotification) => void;
}) {
  const coalesced = isCoalescedType(n.type);
  return (
    <button
      type="button"
      onClick={() => onClick(n)}
      className={`w-full text-left px-4 py-4 focus:outline-none focus-visible:bg-gray-50 hover:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {!n.is_read && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            )}
            <p className="text-sm font-semibold text-gray-900 leading-snug min-w-0 truncate">
              {n.title}
            </p>
            {coalesced && !n.is_read && n.message_count > 1 && (
              <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {n.message_count > 99 ? "99+" : n.message_count}
              </span>
            )}
          </div>
          {n.body && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{n.body}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-500 mt-1">
          {formatTime(new Date(coalesced ? n.updated_at : n.created_at))}
        </span>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NotifTab>("All");
  const [showAllRead, setShowAllRead] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNotifications().then((result) => {
      if (!cancelled) {
        setNotifications(result.data ?? []);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Stay in sync when a thread is marked read elsewhere (e.g. opening the chat
  // on another tab) — matches the desktop panel's behaviour.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(
        `notifications-page-${userId}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string;
            is_read: boolean;
          };
          if (updated.is_read) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updated.id
                  ? { ...n, is_read: true, message_count: 0 }
                  : n,
              ),
            );
          }
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function handleClick(n: SelectNotification) {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? { ...item, is_read: true, message_count: 0 }
            : item,
        ),
      );
    }
    if (n.url) router.push(n.url);
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, message_count: 0 })),
    );
  }

  const hasUnread = notifications.some((n) => !n.is_read);
  const filtered = notifications.filter((n) => matchesTab(n.type, activeTab));
  const unread = filtered.filter((n) => !n.is_read);
  const read = filtered.filter((n) => n.is_read);
  const visibleRead = showAllRead ? read : read.slice(0, READ_THRESHOLD);
  const hiddenReadCount = Math.max(0, read.length - READ_THRESHOLD);

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
          <>
            <NotificationFilter active={activeTab} onChange={setActiveTab} />
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm pt-10">
                Nothing here yet
              </p>
            ) : (
              <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white mt-2">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} onClick={handleClick} />
                ))}
                {visibleRead.map((n) => (
                  <NotificationRow key={n.id} n={n} onClick={handleClick} />
                ))}
                {!showAllRead && hiddenReadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRead(true)}
                    className="w-full py-3 text-xs text-[#3761B0] hover:underline text-center"
                  >
                    Show {hiddenReadCount} more
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
