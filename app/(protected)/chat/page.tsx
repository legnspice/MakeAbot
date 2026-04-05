"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { ChatRoom } from "@/components/chat-room";
import { useAuth } from "@/contexts/auth-context";
import { ChatSidebarSkeleton } from "@/components/ui/skeletons/chat-skeleton";
import { getPosts, getPostBids } from "@/lib/actions/posts";
import { getRequests, getRequestBids } from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";
import { getLatestTimestampsForBids } from "@/lib/actions/messages";

type ConversationEntry = {
  bidId: string;
  kind: "offer" | "request";
  title: string;
  otherName: string;
  otherId: string;
  lastMessageAt: Date | null;
};

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const bidIdParam = params.get("bidId") ?? "";
  const kindParam = (params.get("kind") ?? "offer") as "offer" | "request";
  const titleParam = params.get("title") ?? "ITEM";
  const otherIdParam = params.get("otherId") ?? "";

  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationEntry | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  const loadConversations = useCallback(async () => {
    const items: ConversationEntry[] = [];

    // Posts I own → bids on them (others requested my offer)
    const myPostsResult = await getPosts({ user_id: currentUser.id });
    const myPostBidsResult = await getPostBids({ bidder_id: currentUser.id });
    const myRequestsResult = await getRequests({ user_id: currentUser.id });
    const myReqBidsResult = await getRequestBids({ bidder_id: currentUser.id });

    // Collect all user IDs we need to look up
    const userIds = new Set<string>();

    for (const post of myPostsResult.data ?? []) {
      const bidsResult = await getPostBids({ post_id: post.id });
      for (const bid of bidsResult.data ?? []) {
        userIds.add(bid.bidder_id);
        items.push({
          bidId: bid.id,
          kind: "offer",
          title: post.title,
          otherName: "",
          otherId: bid.bidder_id,
          lastMessageAt: null,
        });
      }
    }

    for (const bid of myPostBidsResult.data ?? []) {
      const postResult = await getPosts({ id: bid.post_id });
      const post = postResult.data?.[0];
      if (post && post.user_id) {
        userIds.add(post.user_id);
        items.push({
          bidId: bid.id,
          kind: "offer",
          title: post.title,
          otherName: "",
          otherId: post.user_id,
          lastMessageAt: null,
        });
      }
    }

    for (const req of myRequestsResult.data ?? []) {
      const bidsResult = await getRequestBids({ request_id: req.id });
      for (const bid of bidsResult.data ?? []) {
        userIds.add(bid.bidder_id);
        items.push({
          bidId: bid.id,
          kind: "request",
          title: req.title,
          otherName: "",
          otherId: bid.bidder_id,
          lastMessageAt: null,
        });
      }
    }

    for (const bid of myReqBidsResult.data ?? []) {
      const reqResult = await getRequests({ id: bid.request_id });
      const req = reqResult.data?.[0];
      if (req && req.user_id) {
        userIds.add(req.user_id);
        items.push({
          bidId: bid.id,
          kind: "request",
          title: req.title,
          otherName: "",
          otherId: req.user_id,
          lastMessageAt: null,
        });
      }
    }

    // Batch fetch all users and last-message timestamps at once
    const postBidIds = items.filter((i) => i.kind === "offer").map((i) => i.bidId);
    const reqBidIds = items.filter((i) => i.kind === "request").map((i) => i.bidId);

    const [usersResult, timestampsResult] = await Promise.all([
      userIds.size > 0 ? getUsers({ ids: Array.from(userIds) }) : { data: [] },
      getLatestTimestampsForBids(postBidIds, reqBidIds),
    ]);

    const usersMap = new Map<string, string>();
    for (const u of usersResult.data ?? []) {
      usersMap.set(u.id, u.name ?? "User");
    }

    const timestamps = timestampsResult.data ?? new Map<string, Date>();

    for (const item of items) {
      item.otherName = usersMap.get(item.otherId) ?? "User";
      item.lastMessageAt = timestamps.get(item.bidId) ?? null;
    }

    // Sort by most recent message first; conversations with no messages go last
    items.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
    });

    setConversations(items);
    setLoading(false);
    return items;
  }, [currentUser.id]);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations().then((items) => {
      if (!bidIdParam) return;
      const match = items.find((c) => c.bidId === bidIdParam);
      setSelectedConv(
        match ?? {
          bidId: bidIdParam,
          kind: kindParam,
          title: titleParam,
          otherName: "",
          otherId: otherIdParam,
          lastMessageAt: null,
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
              onClick={() => router.push("/tracker")}
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
                <p className="font-bold text-gray-900 leading-tight line-clamp-1">
                  {titleParam}
                </p>
                <p className="text-xs text-gray-500 leading-tight">
                  {kindParam === "offer" ? "Offer" : "Request"}
                </p>
              </div>
            </header>
            <div className="flex-1 min-h-0">
              <ChatRoom
                other_user_id={otherIdParam}
                post_bid_id={kindParam === "offer" ? bidIdParam : null}
                request_bid_id={kindParam === "request" ? bidIdParam : null}
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
            <ChatSidebarSkeleton />
          ) : conversations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm pt-10">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.bidId}
                type="button"
                onClick={() => selectConversation(conv)}
                className={`w-full text-left px-5 py-4 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                  selectedConv?.bidId === conv.bidId ? "bg-gray-100" : ""
                }`}
              >
                <p className="font-bold text-gray-900 text-sm uppercase leading-tight">
                  {conv.title}
                </p>
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
              <header className="bg-[#E8ECFF] flex items-center px-5 py-3 gap-3 shrink-0 border-b border-blue-100">
                <div className="w-9 h-9 rounded bg-[#8B5E52] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                    {selectedConv.kind === "offer" ? "OFFER" : "REQUEST"}
                    {" | "}
                    {selectedConv.otherName || selectedConv.title}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight truncate">
                    {selectedConv.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedConv(null)}
                  className="text-[#3761B0] hover:text-[#2a4d8a] transition-colors p-1 rounded-full hover:bg-blue-50"
                  aria-label="Close"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </header>

              {/* Chat room */}
              <div className="flex-1 min-h-0">
                <ChatRoom
                  other_user_id={selectedConv.otherId}
                  post_bid_id={
                    selectedConv.kind === "offer" ? selectedConv.bidId : null
                  }
                  request_bid_id={
                    selectedConv.kind === "request" ? selectedConv.bidId : null
                  }
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

import { PageShellSkeleton } from "@/components/ui/page-shell-skeleton";

export default function ChatPage() {
  return (
    <Suspense fallback={<PageShellSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}
