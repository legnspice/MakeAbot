"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { buildUnreadMap } from "@/lib/unread";

/**
 * Live map of unread message counts keyed by bid/thread id (context_id).
 * Mirrors the notifications-bell pattern: reads notifications directly via the
 * Supabase client and refetches on realtime INSERT/UPDATE.
 */
export function useUnreadCounts() {
  const { userData } = useAuth();
  const userId = userData.publicUser.id;
  const [unreadByContext, setUnreadByContext] = useState<
    Record<string, number>
  >({});
  const fetchSeq = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    const supabase = createClient();

    const load = async () => {
      fetchSeq.current += 1;
      const mySeq = fetchSeq.current;
      const { data } = await supabase
        .from("notifications")
        .select("context_id, message_count")
        .eq("user_id", userId)
        .eq("is_read", false)
        .in("type", ["new_message", "new_inquiry"])
        .not("context_id", "is", null);
      if (isMounted && mySeq === fetchSeq.current) {
        setUnreadByContext(buildUnreadMap(data ?? []));
      }
    };

    void load();

    const channelName = `unread-counts-${userId}-${Math.random().toString(36).slice(2)}`;
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
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const totalUnread = Object.values(unreadByContext).reduce((s, n) => s + n, 0);
  return { unreadByContext, totalUnread };
}
