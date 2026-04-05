"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

type Props = {
  /** If true, renders as a nav link to /notifications (mobile bottom nav style).
   *  If false, renders as a button that calls onClick (desktop panel style). */
  asLink?: boolean;
  onClick?: () => void;
  /** Extra className for the icon wrapper */
  className?: string;
};

export default function NotificationsBell({ asLink = false, onClick, className = "" }: Props) {
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => setUnreadCount((c) => c + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  const badge =
    unreadCount > 0 ? (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  const inner = (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Bell className="w-5 h-5" strokeWidth={2} />
      {badge}
    </span>
  );

  if (asLink) {
    return (
      <Link href="/notifications" aria-label="Notifications">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Notifications"
      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#3761B0] transition-colors"
    >
      {inner}
      <span>Notifications</span>
    </button>
  );
}
