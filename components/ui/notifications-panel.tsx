"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, GearFill } from "react-bootstrap-icons";
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
} from "@/lib/actions/notifications";
import type { SelectNotification } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

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

type ActiveTab = "All" | "Messages" | "Activity";

const CATEGORY_MAP: Record<string, ActiveTab> = {
  new_message: "Messages",
  new_review: "Activity",
  new_request: "Activity",
};

function filterByTab(
  notifications: SelectNotification[],
  tab: ActiveTab,
): SelectNotification[] {
  if (tab === "All") return notifications;
  return notifications.filter(
    (n) => (CATEGORY_MAP[n.type] ?? "Activity") === tab,
  );
}

const READ_THRESHOLD = 3;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [notifications, setNotifications] = useState<SelectNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("All");
  const [showAllRead, setShowAllRead] = useState(false);

  const loading = open && !loaded;

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("All");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAllRead(false);
      return;
    }
    if (loaded) return;
    let cancelled = false;
    getNotifications().then((result) => {
      if (!cancelled) {
        setNotifications(result.data ?? []);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  // Keep panel in sync when markChatNotificationRead fires externally (e.g. from chat-room).
  useEffect(() => {
    if (!open || !loaded || !userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-panel-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; is_read: boolean; message_count: number };
          if (updated.is_read) {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updated.id ? { ...n, is_read: true, message_count: 0 } : n,
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
  }, [open, loaded, userId]);

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
    if (n.url) {
      router.push(n.url);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, message_count: 0 })),
    );
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  const TABS: ActiveTab[] = ["All", "Messages", "Activity"];

  const filtered = filterByTab(notifications, activeTab);
  const unread = filtered.filter((n) => !n.is_read);
  const read = filtered.filter((n) => n.is_read);
  const visibleRead = showAllRead ? read : read.slice(0, READ_THRESHOLD);
  const hiddenReadCount = Math.max(0, read.length - READ_THRESHOLD);

  function renderNotification(n: SelectNotification) {
    const isMessage = n.type === "new_message";
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleClick(n)}
        className={`w-full text-left px-5 py-4 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!n.is_read && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          )}
          <p className="text-sm font-semibold text-gray-900 leading-snug flex-1 min-w-0 truncate">
            {n.title}
          </p>
          {isMessage && !n.is_read && n.message_count > 1 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {n.message_count > 99 ? "99+" : n.message_count}
            </span>
          )}
        </div>
        {n.body && (
          <p className="mt-0.5 text-sm text-gray-600 truncate">{n.body}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {formatTime(new Date(isMessage ? n.updated_at : n.created_at))}
        </p>
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-100 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
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
              onClick={() => {
                router.push("/settings/notifications");
                onClose();
              }}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Notification settings"
            >
              <GearFill size={20} className="text-gray-600" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Close notifications"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                activeTab === tab
                  ? "text-[#3761B0] border-b-2 border-[#3761B0]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">
              No notifications yet
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {unread.map(renderNotification)}
              {visibleRead.map(renderNotification)}
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
        </div>
      </div>
    </>
  );
}
