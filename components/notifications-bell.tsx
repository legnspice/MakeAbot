"use client";

import { BellFill } from "react-bootstrap-icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

export default function NotificationsBell({
  asLink = false,
  onClick,
  className = "",
}: Props) {
  const pathname = usePathname();
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [unreadCount, setUnreadCount] = useState(0);
  // Sequence counter — only the latest in-flight fetch may write to state.
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const supabase = createClient();

    const loadUnreadCount = async () => {
      fetchSeq.current += 1;
      const mySeq = fetchSeq.current;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      // Discard result if a newer fetch has already been dispatched or component unmounted.
      if (isMounted && mySeq === fetchSeq.current) {
        setUnreadCount(count ?? 0);
      }
    };

    void loadUnreadCount();

    const channelName = `notifications-bell-${userId}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Re-fetch instead of blindly incrementing — INSERT for a notification that
          // gets immediately suppressed (e.g. user is in that chat) would leave the
          // count permanently inflated if we only did setUnreadCount(c => c + 1).
          void loadUnreadCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const badge =
    unreadCount > 0 && pathname !== "/chat" ? (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;

  const inner = (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <BellFill size={20} />
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
