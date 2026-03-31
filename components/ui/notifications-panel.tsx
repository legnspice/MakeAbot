'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({ open, onClose }: Props) {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
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
    setLoaded(true);
  }, [currentUser.id]);

  useEffect(() => {
    if (open && !loaded) {
      loadNotifications();
    }
  }, [open, loaded, loadNotifications]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-100 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Close notifications"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">No notifications yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.href) {
                      router.push(n.href);
                      onClose();
                    }
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-400">{n.meta}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
