'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { ChatRoom } from '@/components/chat-room';
import { useAuth } from '@/contexts/auth-context';
import { getPosts, getPostBids } from '@/lib/actions/posts';
import { getRequests, getRequestBids } from '@/lib/actions/requests';
import { getUsers } from '@/lib/actions/users';

type ConversationEntry = {
  bidId: string;
  kind: 'offer' | 'request';
  title: string;
  otherName: string;
  otherId: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();

  const bidIdParam = params.get('bidId') ?? '';
  const kindParam = (params.get('kind') ?? 'offer') as 'offer' | 'request';
  const titleParam = params.get('title') ?? 'ITEM';
  const otherIdParam = params.get('otherId') ?? '';

  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  const loadConversations = useCallback(async () => {
    const items: ConversationEntry[] = [];

    // Posts I own → bids on them (others requested my offer)
    const myPostsResult = await getPosts({ user_id: currentUser.id });
    for (const post of myPostsResult.data ?? []) {
      const bidsResult = await getPostBids({ post_id: post.id });
      for (const bid of bidsResult.data ?? []) {
        const userResult = await getUsers({ id: bid.bidder_id });
        const name = userResult.data?.[0]?.name ?? 'User';
        items.push({ bidId: bid.id, kind: 'offer', title: post.title, otherName: name, otherId: bid.bidder_id });
      }
    }

    // Bids I made on others' posts
    const myPostBidsResult = await getPostBids({ bidder_id: currentUser.id });
    for (const bid of myPostBidsResult.data ?? []) {
      const postResult = await getPosts({ id: bid.post_id });
      const post = postResult.data?.[0];
      if (post && post.user_id) {
        const userResult = await getUsers({ id: post.user_id });
        const name = userResult.data?.[0]?.name ?? 'User';
        items.push({ bidId: bid.id, kind: 'offer', title: post.title, otherName: name, otherId: post.user_id });
      }
    }

    // Requests I own → bids on them (others offered to help)
    const myRequestsResult = await getRequests({ user_id: currentUser.id });
    for (const req of myRequestsResult.data ?? []) {
      const bidsResult = await getRequestBids({ request_id: req.id });
      for (const bid of bidsResult.data ?? []) {
        const userResult = await getUsers({ id: bid.bidder_id });
        const name = userResult.data?.[0]?.name ?? 'User';
        items.push({ bidId: bid.id, kind: 'request', title: req.title, otherName: name, otherId: bid.bidder_id });
      }
    }

    // Bids I made on others' requests
    const myReqBidsResult = await getRequestBids({ bidder_id: currentUser.id });
    for (const bid of myReqBidsResult.data ?? []) {
      const reqResult = await getRequests({ id: bid.request_id });
      const req = reqResult.data?.[0];
      if (req && req.user_id) {
        const userResult = await getUsers({ id: req.user_id });
        const name = userResult.data?.[0]?.name ?? 'User';
        items.push({ bidId: bid.id, kind: 'request', title: req.title, otherName: name, otherId: req.user_id });
      }
    }

    setConversations(items);
    setLoading(false);
    return items;
  }, [currentUser.id]);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    loadConversations().then((items) => {
      if (!bidIdParam) return;
      const match = items.find((c) => c.bidId === bidIdParam);
      setSelectedConv(
        match ?? {
          bidId: bidIdParam,
          kind: kindParam,
          title: titleParam,
          otherName: '',
          otherId: otherIdParam,
        },
      );
    });
  }, [loadConversations, bidIdParam, kindParam, titleParam, otherIdParam]);

  const selectConversation = (conv: ConversationEntry) => {
    setSelectedConv(conv);
    router.replace(
      `/chat?bidId=${conv.bidId}&kind=${conv.kind}&title=${encodeURIComponent(conv.title)}&otherId=${conv.otherId}`,
    );
  };

  // ── Mobile: invalid link guard ──
  const mobileInvalid = !bidIdParam || !otherIdParam;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* ── Mobile layout ── */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col pb-16">
        {mobileInvalid ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
            <p>No conversation selected.</p>
            <button
              type="button"
              onClick={() => router.push('/tracker')}
              className="text-[#3761B0] underline text-sm"
            >
              Go to Tracker
            </button>
          </div>
        ) : (
          <>
            <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-9 h-9 rounded-full border border-[#3761B0] text-[#3761B0] flex items-center justify-center shrink-0"
                aria-label="Back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 leading-tight line-clamp-1">{titleParam}</p>
                <p className="text-xs text-gray-500 leading-tight">
                  {kindParam === 'offer' ? 'Offer' : 'Request'}
                </p>
              </div>
            </header>
            <div className="flex-1 min-h-0">
              <ChatRoom
                other_user_id={otherIdParam}
                post_bid_id={kindParam === 'offer' ? bidIdParam : null}
                request_bid_id={kindParam === 'request' ? bidIdParam : null}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-96 border-r border-gray-200 overflow-y-auto shrink-0">
          {loading ? (
            <p className="text-center text-gray-400 text-sm pt-10">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.bidId}
                type="button"
                onClick={() => selectConversation(conv)}
                className={`w-full text-left px-5 py-4 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                  selectedConv?.bidId === conv.bidId ? 'bg-gray-100' : ''
                }`}
              >
                <p className="font-bold text-gray-900 text-sm uppercase leading-tight">{conv.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{conv.otherName}</p>
              </button>
            ))
          )}
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {selectedConv ? (
            <>
              {/* Header */}
              <header className="bg-[#E8ECFF] flex items-center px-5 py-3 gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-gray-300 shrink-0" />
                <span className="font-semibold text-gray-900 flex-1 leading-tight">
                  {selectedConv.otherName || selectedConv.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedConv(null)}
                  className="text-[#3761B0] hover:text-[#2a4d8a] transition-colors"
                  aria-label="Close"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </header>

              {/* Chat room */}
              <div className="flex-1 min-h-0">
                <ChatRoom
                  other_user_id={selectedConv.otherId}
                  post_bid_id={selectedConv.kind === 'offer' ? selectedConv.bidId : null}
                  request_bid_id={selectedConv.kind === 'request' ? selectedConv.bidId : null}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
