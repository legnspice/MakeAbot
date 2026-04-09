"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import FilterBar, { type DateSort, type PriceSort } from "@/components/ui/filter-bar";
import { useAuth } from "@/contexts/auth-context";
import { TrackerPageSkeleton } from "@/components/ui/skeletons/tracker-skeleton";
import { getPosts, getPostBids } from "@/lib/actions/posts";
import { getRequests, getRequestBids } from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";
import { ChatDotsFill, XLg } from "react-bootstrap-icons";
import ItemRequestCard from "@/components/ui/item";
import { removePost } from "@/lib/actions/posts";
import { removeRequest } from "@/lib/actions/requests";

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
  description: string | null;
  imageUrl: string | null;
  price: string;
  type: string | null;
  isOwned: boolean;
  requesterCount: number;
  requesters: { id: string; name: string; bidId: string }[];
  notificationCount?: number;
};

type TrackerRequest = {
  id: string;
  itemName: string;
  description: string | null;
  imageUrl: string | null;
  status: string;
  price: string;
  type: string | null;
  urgency: string | null;
  isOwned: boolean;
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
    description: post.description ?? null,
    imageUrl: post.imgUrl ?? null,
    price: formatPrice(post.price),
    type: post.type ?? null,
    isOwned: true,
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
      description: post.description ?? null,
      imageUrl: post.imgUrl ?? null,
      price: formatPrice(post.price),
      type: post.type ?? null,
      isOwned: false,
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
    description: req.description ?? null,
    imageUrl: req.imgUrl ?? null,
    status: req.status,
    price: formatPrice(req.fee),
    type: req.type ?? null,
    urgency: req.urgency ?? null,
    isOwned: true,
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
      description: req.description ?? null,
      imageUrl: req.imgUrl ?? null,
      status: req.status,
      price: formatPrice(req.fee),
      type: req.type ?? null,
      urgency: req.urgency ?? null,
      isOwned: false,
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
  const [dateSort, setDateSort] = useState<DateSort | null>(null);
  const [priceSort, setPriceSort] = useState<PriceSort | null>(null);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [offers, setOffers] = useState<TrackerOffer[]>([]);
  const [requests, setRequests] = useState<TrackerRequest[]>([]);
  const [modalData, setModalData] = useState<{
    title: string;
    people: { id: string; name: string; bidId: string }[];
    type: "offer" | "request";
  } | null>(null);

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

  const sortedCards = (() => {
    const base = filteredCards.map((card, i) => ({ card, i }));
    base.sort((a, b) => {
      if (priceSort) {
        const pA = a.card.data.price;
        const pB = b.card.data.price;
        const diff = getPriceRank(pA) - getPriceRank(pB);
        if (diff !== 0) return priceSort === "price-lowest" ? diff : -diff;
      }
      if (dateSort === "date-oldest") return b.i - a.i;
      return a.i - b.i; // date-newest / default
    });
    return base.map(({ card }) => card);
  })();

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

  const handleDeleteOffer = async (offerId: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    await removePost(offerId);
    setOffers((prev) => prev.filter((o) => o.id !== offerId));
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    await removeRequest(requestId);
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <FilterBar
        filterLabels={allFilterLabels}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        addFilterOpen={addFilterOpen}
        onAddFilterOpenChange={setAddFilterOpen}
        newFilterName={newFilterName}
        onNewFilterNameChange={setNewFilterName}
        onAddFilter={handleAddFilter}
        dateSort={dateSort}
        priceSort={priceSort}
        onDateSortChange={setDateSort}
        onPriceSortChange={setPriceSort}
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
              {sortedCards.map((card) => {
                if (card.type === "offer") {
                  const offer = card.data as TrackerOffer;
                  return (
                    <div key={`offer-${offer.id}`}>
                      <ItemRequestCard
                        variant="lent"
                        requestedBy={offer.isOwned ? "Offered by: You" : `Offered by: ${offer.requesters[0]?.name ?? "User"}`}
                        price={offer.price}
                        typeBadge="Offer"
                        detail={{
                          title: offer.itemName,
                          lentBy: offer.isOwned ? "You" : (offer.requesters[0]?.name ?? "User"),
                          quantity: 1,
                          price: offer.price,
                          description: offer.description ?? undefined,
                          imageUrl: offer.imageUrl ?? undefined,
                        }}
                        onClick={offer.requesterCount > 0 ? () => setModalData({ title: offer.itemName, people: offer.requesters, type: "offer" }) : undefined}
                        onEdit={offer.isOwned ? () => router.push(`/create-offer?edit=${offer.id}`) : undefined}
                        onDelete={offer.isOwned ? () => handleDeleteOffer(offer.id) : undefined}
                      />
                    </div>
                  );
                } else {
                  const request = card.data as TrackerRequest;
                  return (
                    <div key={`request-${request.id}`}>
                      <ItemRequestCard
                        variant="requested"
                        requestedBy={request.isOwned ? "Requested by: You" : `Requested by: ${request.bidders[0]?.name ?? "User"}`}
                        price={request.price}
                        typeBadge="Request"
                        detail={{
                          title: request.itemName,
                          requestedBy: request.isOwned ? "You" : (request.bidders[0]?.name ?? "User"),
                          quantity: 1,
                          price: request.price,
                          description: request.description ?? undefined,
                          imageUrl: request.imageUrl ?? undefined,
                        }}
                        onClick={request.bidders.length > 0 ? () => setModalData({ title: request.itemName, people: request.bidders, type: "request" }) : undefined}
                        onEdit={request.isOwned ? () => router.push(`/create-request?edit=${request.id}`) : undefined}
                        onDelete={request.isOwned ? () => handleDeleteRequest(request.id) : undefined}
                      />
                    </div>
                  );
                }
              })}
            </div>
          </section>
          {modalData && (
            <ChatListModal
              title={modalData.title}
              people={modalData.people}
              accentClass={modalData.type === "offer" ? "bg-gray-50 hover:bg-gray-100" : "bg-blue-50 hover:bg-blue-100"}
              avatarClass={modalData.type === "offer" ? "bg-gray-300 text-gray-600" : "bg-blue-200 text-blue-700"}
              iconClass={modalData.type === "offer" ? "text-gray-400" : "text-blue-400"}
              onSelect={(bidId, otherId) =>
                goToChat(bidId, modalData.type, modalData.title, otherId)
              }
              onClose={() => setModalData(null)}
            />
          )}
        </main>
      )}

      <BottomNav />
    </div>
  );
}

function ChatListModal({
  title,
  people,
  accentClass,
  avatarClass,
  iconClass,
  onSelect,
  onClose,
}: {
  title: string;
  people: { id: string; name: string; bidId: string }[];
  accentClass: string;
  avatarClass: string;
  iconClass: string;
  onSelect: (bidId: string, id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-gray-900 truncate pr-4">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <XLg className="text-gray-500" size={16} />
          </button>
        </div>
        <ul className="overflow-y-auto space-y-2">
          {people.map((p) => (
            <li key={p.bidId}>
              <button
                type="button"
                onClick={() => { onSelect(p.bidId, p.id); onClose(); }}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${accentClass} transition-colors`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-7 h-7 shrink-0 rounded-full ${avatarClass} flex items-center justify-center text-xs font-semibold`}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {p.name}
                  </span>
                </div>
                <ChatDotsFill className={`shrink-0 ${iconClass}`} size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
