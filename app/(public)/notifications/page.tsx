'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { useAuth } from '@/contexts/auth-context';
import { getPosts, getPostBids } from '@/lib/actions/posts';
import { getRequests, getRequestBids } from '@/lib/actions/requests';
import { getMessages } from '@/lib/actions/messages';
import { getUsers } from '@/lib/actions/users';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  meta: string;
  href?: string;
};

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    const items: NotificationItem[] = [];

    // Fetch all data in parallel
    const [postsResult, requestsResult, messagesResult] = await Promise.all([
      getPosts({ user_id: currentUser.id }),
      getRequests({ user_id: currentUser.id }),
      getMessages({ receiver_id: currentUser.id }),
    ]);

    // Fetch all bids in parallel
    const postBidFetches = (postsResult.data ?? []).map((post) =>
      getPostBids({ post_id: post.id }).then((r) => ({ post, bids: r.data ?? [] }))
    );
    const reqBidFetches = (requestsResult.data ?? []).map((req) =>
      getRequestBids({ request_id: req.id }).then((r) => ({ req, bids: r.data ?? [] }))
    );
    const [postBidGroups, reqBidGroups] = await Promise.all([
      Promise.all(postBidFetches),
      Promise.all(reqBidFetches),
    ]);

    // Collect all user IDs to batch-fetch
    const userIds = new Set<string>();
    for (const { bids } of postBidGroups) {
      for (const bid of bids) userIds.add(bid.bidder_id);
    }
    for (const { bids } of reqBidGroups) {
      for (const bid of bids) userIds.add(bid.bidder_id);
    }
    const unread = (messagesResult.data ?? []).filter((m) => !m.is_read);
    for (const msg of unread) userIds.add(msg.sender_id);

    const usersMap = new Map<string, string>();
    if (userIds.size > 0) {
      const usersResult = await getUsers({ ids: Array.from(userIds) });
      for (const u of usersResult.data ?? []) {
        usersMap.set(u.id, u.name ?? 'Someone');
      }
    }

    // 1. New bids on my posts (someone wants my offer)
    for (const { post, bids } of postBidGroups) {
      for (const bid of bids) {
        const name = usersMap.get(bid.bidder_id) ?? 'Someone';
        items.push({
          id: `post-bid-${bid.id}`,
          title: `New request for ${post.title}`,
          body: `by ${name}`,
          meta: formatTime(bid.created_at),
          href: `/chat?bidId=${bid.id}&kind=offer&title=${encodeURIComponent(post.title)}&otherId=${bid.bidder_id}`,
        });
      }
    }

    // 2. New bids on my requests (someone offered to help)
    for (const { req, bids } of reqBidGroups) {
      for (const bid of bids) {
        const name = usersMap.get(bid.bidder_id) ?? 'Someone';
        items.push({
          id: `req-bid-${bid.id}`,
          title: `New offer for ${req.title}`,
          body: `by ${name}`,
          meta: formatTime(bid.created_at),
          href: `/chat?bidId=${bid.id}&kind=request&title=${encodeURIComponent(req.title)}&otherId=${bid.bidder_id}`,
        });
      }
    }

    // 3. Unread messages
    for (const msg of unread) {
      const name = usersMap.get(msg.sender_id) ?? 'Someone';
      items.push({
        id: `msg-${msg.id}`,
        title: `New message from ${name}`,
        body: msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content,
        meta: formatTime(msg.timestamp),
      });
    }

    setNotifications(items);
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-28">
        {loading ? (
          <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-center text-gray-400 text-sm pt-10">No notifications yet</p>
        ) : (
          <section aria-label="Notifications">
            <div className="divide-y divide-gray-200 border-t border-b border-gray-200 bg-white">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => n.href && router.push(n.href)}
                  className="w-full text-left px-4 py-4 focus:outline-none focus-visible:bg-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">
                        {n.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500 mt-1">{n.meta}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
