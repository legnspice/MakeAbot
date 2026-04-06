"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import FilterBar, { type SortOption } from "@/components/ui/filter-bar";
import { useAuth } from "@/contexts/auth-context";
import { TrackerPageSkeleton } from "@/components/ui/skeletons/tracker-skeleton";
import { getPosts, getPostBids } from "@/lib/actions/posts";
import { getRequests, getRequestBids } from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";

function getPriceRank(price: string): number {
  const p = price.toUpperCase();
  if (p === "FREE") return 0;
  if (p.startsWith("₱")) return parseInt(p.slice(1), 10) || 1;
  if (p === "$") return 1;
  if (p === "$$") return 2;
  if (p === "$$$") return 3;
  return 4;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return "FREE";
  return `₱${value}`;
}

type TrackerOffer = {
  id: string;
  itemName: string;
  requesterCount: number;
  requesters: { id: string; name: string; bidId: string }[];
  notificationCount?: number;
};

type TrackerRequest = {
  id: string;
  itemName: string;
  status: string;
  price: string;
  bidders: { id: string; name: string; bidId: string }[];
  notificationCount?: number;
};

type TrackerCard =
  | { type: "offer"; data: TrackerOffer }
  | { type: "request"; data: TrackerRequest };

async function fetchTrackerData(userId: string) {
  const [postsResult, requestsResult, myPostBidsResult, myReqBidsResult] =
    await Promise.all([
      getPosts({ user_id: userId }),
      getRequests({ user_id: userId }),
      getPostBids({ bidder_id: userId }),
      getRequestBids({ bidder_id: userId }),
    ]);

  // Bids on my posts
  const postBidFetches = (postsResult.data ?? []).map((post) =>
    getPostBids({ post_id: post.id }).then((r) => ({
      post,
      bids: r.data ?? [],
    })),
  );
  // Bids on my requests
  const reqBidFetches = (requestsResult.data ?? []).map((req) =>
    getRequestBids({ request_id: req.id }).then((r) => ({
      req,
      bids: r.data ?? [],
    })),
  );

  // Posts I bid on (fetch each post)
  const myPostBids = myPostBidsResult.data ?? [];
  const bidPostFetches = myPostBids.map((bid) =>
    getPosts({ id: bid.post_id }).then((r) => ({
      bid,
      post: r.data?.[0] ?? null,
    })),
  );

  // Requests I bid on (fetch each request)
  const myReqBids = myReqBidsResult.data ?? [];
  const bidReqFetches = myReqBids.map((bid) =>
    getRequests({ id: bid.request_id }).then((r) => ({
      bid,
      req: r.data?.[0] ?? null,
    })),
  );

  const [postBidGroups, reqBidGroups, bidPostGroups, bidReqGroups] =
    await Promise.all([
      Promise.all(postBidFetches),
      Promise.all(reqBidFetches),
      Promise.all(bidPostFetches),
      Promise.all(bidReqFetches),
    ]);

  // Collect all user IDs we need names for
  const userIds = new Set<string>();
  for (const { bids } of postBidGroups)
    for (const bid of bids) userIds.add(bid.bidder_id);
  for (const { bids } of reqBidGroups)
    for (const bid of bids) userIds.add(bid.bidder_id);
  for (const { post } of bidPostGroups)
    if (post?.user_id) userIds.add(post.user_id);
  for (const { req } of bidReqGroups)
    if (req?.user_id) userIds.add(req.user_id);

  const usersMap = new Map<string, string>();
  if (userIds.size > 0) {
    const usersResult = await getUsers({ ids: Array.from(userIds) });
    for (const u of usersResult.data ?? [])
      usersMap.set(u.id, u.name ?? "User");
  }

  // My own post IDs (to avoid duplicates)
  const myPostIds = new Set(
    (postsResult.data ?? []).map((p) => p.id),
  );
  const myRequestIds = new Set(
    (requestsResult.data ?? []).map((r) => r.id),
  );

  // Cards for my offers (posts I own)
  const offerList: TrackerOffer[] = postBidGroups.map(({ post, bids }) => ({
    id: post.id,
    itemName: post.title,
    requesterCount: bids.length,
    requesters: bids.map((bid) => ({
      id: bid.bidder_id,
      name: usersMap.get(bid.bidder_id) ?? "User",
      bidId: bid.id,
    })),
  }));

  // Cards for posts I bid on (not my own)
  for (const { bid, post } of bidPostGroups) {
    if (!post || !post.user_id || myPostIds.has(post.id)) continue;
    offerList.push({
      id: `bid-${bid.id}`,
      itemName: post.title,
      requesterCount: 1,
      requesters: [
        {
          id: post.user_id,
          name: usersMap.get(post.user_id) ?? "User",
          bidId: bid.id,
        },
      ],
    });
  }

  // Cards for my requests (requests I own)
  const requestList: TrackerRequest[] = reqBidGroups.map(({ req, bids }) => ({
    id: req.id,
    itemName: req.title,
    status: req.status,
    price: formatPrice(req.fee),
    bidders: bids.map((bid) => ({
      id: bid.bidder_id,
      name: usersMap.get(bid.bidder_id) ?? "User",
      bidId: bid.id,
    })),
    notificationCount: bids.length > 0 ? bids.length : undefined,
  }));

  // Cards for requests I bid on (not my own)
  for (const { bid, req } of bidReqGroups) {
    if (!req || !req.user_id || myRequestIds.has(req.id)) continue;
    requestList.push({
      id: `bid-${bid.id}`,
      itemName: req.title,
      status: req.status,
      price: formatPrice(req.fee),
      bidders: [
        {
          id: req.user_id,
          name: usersMap.get(req.user_id) ?? "User",
          bidId: bid.id,
        },
      ],
    });
  }

  return { offerList, requestList };
}

export default function TrackerPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [offers, setOffers] = useState<TrackerOffer[]>([]);
  const [requests, setRequests] = useState<TrackerRequest[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTrackerData(currentUser.id).then(({ offerList, requestList }) => {
      if (!cancelled) {
        setOffers(offerList);
        setRequests(requestList);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  const allFilterLabels = ["All", "Offers", "Requests", ...customFilters];

  const filterOffers = (list: TrackerOffer[]) =>
    activeFilter === "All" || activeFilter === "Offers"
      ? list
      : activeFilter === "Requests"
        ? []
        : list.filter((o) =>
            o.itemName.toLowerCase().includes(activeFilter.toLowerCase()),
          );

  const filterRequests = (list: TrackerRequest[]) =>
    activeFilter === "All" || activeFilter === "Requests"
      ? list
      : activeFilter === "Offers"
        ? []
        : list.filter((r) =>
            r.itemName.toLowerCase().includes(activeFilter.toLowerCase()),
          );

  const cards: TrackerCard[] = [
    ...filterOffers(offers).map((data) => ({ type: "offer" as const, data })),
    ...filterRequests(requests).map((data) => ({
      type: "request" as const,
      data,
    })),
  ];

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredCards = searchLower
    ? cards.filter((c) => c.data.itemName.toLowerCase().includes(searchLower))
    : cards;

  const sortedCards =
    sortBy === "date"
      ? filteredCards
      : [...filteredCards].sort((a, b) => {
          const priceA = a.type === "offer" ? "FREE" : a.data.price;
          const priceB = b.type === "offer" ? "FREE" : b.data.price;
          return getPriceRank(priceA) - getPriceRank(priceB);
        });

  const handleAddFilter = () => {
    const name = newFilterName.trim();
    if (name && !customFilters.includes(name)) {
      setCustomFilters((prev) => [...prev, name]);
      setActiveFilter(name);
      setNewFilterName("");
      setAddFilterOpen(false);
    }
  };

  const goToChat = (
    bidId: string,
    kind: "offer" | "request",
    title: string,
    otherId: string,
  ) => {
    router.push(
      `/chat?bidId=${encodeURIComponent(bidId)}&kind=${encodeURIComponent(kind)}&title=${encodeURIComponent(title)}&otherId=${encodeURIComponent(otherId)}`,
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar
        onSearchToggle={() => setSearchOpen((o) => !o)}
        searchOpen={searchOpen}
      />

      <FilterBar
        filterLabels={allFilterLabels}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        addFilterOpen={addFilterOpen}
        onAddFilterOpenChange={setAddFilterOpen}
        newFilterName={newFilterName}
        onNewFilterNameChange={setNewFilterName}
        onAddFilter={handleAddFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortModalOpen={sortModalOpen}
        onSortModalOpenChange={setSortModalOpen}
        showSearch={searchOpen}
        onSearchToggle={() => setSearchOpen((o) => !o)}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {isLoading ? (
        <TrackerPageSkeleton />
      ) : (
        <main className="flex-1 px-4 pt-4 pb-28 md:pb-6">
          <section aria-label="Tracker">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {sortedCards.map((card) =>
                card.type === "offer" ? (
                  <OfferCard
                    key={`offer-${card.data.id}`}
                    offer={card.data}
                    onRequesterClick={(bidId, otherId) =>
                      goToChat(bidId, "offer", card.data.itemName, otherId)
                    }
                  />
                ) : (
                  <RequestCard
                    key={`request-${card.data.id}`}
                    request={card.data}
                    onBidderClick={(bidId, otherId) =>
                      goToChat(bidId, "request", card.data.itemName, otherId)
                    }
                  />
                ),
              )}
            </div>
          </section>
        </main>
      )}

      <BottomNav />
    </div>
  );
}

function OfferCard({
  offer,
  onRequesterClick,
}: {
  offer: TrackerOffer;
  onRequesterClick: (bidId: string, otherId: string) => void;
}) {
  return (
    <div className="relative w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 pr-8">{offer.itemName}</h3>
      <p className="text-sm text-gray-600 mt-1">Offer</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {offer.requesterCount}{" "}
          {offer.requesterCount === 1 ? "requester" : "requesters"}
        </span>
        <div className="flex -space-x-2">
          {offer.requesters.slice(0, 5).map((r) => (
            <button
              key={r.bidId}
              type="button"
              onClick={() => onRequesterClick(r.bidId, r.id)}
              className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium hover:bg-gray-400 transition-colors"
              title={`Chat with ${r.name}`}
            >
              {r.name.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {offer.requesters.length === 0 && (
        <p className="mt-2 text-xs text-gray-400 italic">No requesters yet</p>
      )}
    </div>
  );
}

function RequestCard({
  request,
  onBidderClick,
}: {
  request: TrackerRequest;
  onBidderClick: (bidId: string, otherId: string) => void;
}) {
  return (
    <div className="relative w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {request.notificationCount != null && request.notificationCount > 0 && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
          {request.notificationCount}
        </div>
      )}
      <h3 className="text-lg font-bold text-gray-900 pr-8">
        {request.itemName}
      </h3>
      <p className="text-sm text-gray-600 mt-1">{request.status}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {request.bidders.slice(0, 5).map((b) => (
            <button
              key={b.bidId}
              type="button"
              onClick={() => onBidderClick(b.bidId, b.id)}
              className="w-8 h-8 rounded-full bg-blue-200 border-2 border-white flex items-center justify-center text-blue-700 text-xs font-medium hover:bg-blue-300 transition-colors"
              title={`Chat with ${b.name}`}
            >
              {b.name.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
        <span className="text-[#3761B0] font-semibold">{request.price}</span>
      </div>
      {request.bidders.length === 0 && (
        <p className="mt-2 text-xs text-gray-400 italic">No providers yet</p>
      )}
    </div>
  );
}
