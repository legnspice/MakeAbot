"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import FilterBar, {
  type DateSort,
  type PriceSort,
} from "@/components/ui/filter-bar";
import { useAuth } from "@/contexts/auth-context";
import { TrackerPageSkeleton } from "@/components/ui/skeletons/tracker-skeleton";
import {
  getOffers,
  getOfferBids,
  removeOfferBid,
  withdrawOfferBid,
} from "@/lib/actions/offers";
import {
  getRequests,
  getRequestBids,
  removeRequest,
  removeRequestBid,
  withdrawRequestBid,
} from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";
import {
  ChatDotsFill,
  XLg,
  ChevronDown,
  ChevronRight,
} from "react-bootstrap-icons";
import ItemRequestCard from "@/components/ui/item";
import CreateFab from "@/components/create-fab";
import { markChatNotificationRead } from "@/lib/actions/notifications";
import {
  closeOffer,
  completeRequest,
  completeOfferBid,
} from "@/lib/actions/deals";

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
  status: string;
  isOwned: boolean;
  requesterCount: number;
  rawBidId?: string;
  requesters: { id: string; name: string; bidId: string; bidStatus: string }[];
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
  rawBidId?: string;
  bidders: { id: string; name: string; bidId: string; bidStatus: string }[];
  notificationCount?: number;
};

type TrackerCard =
  | { type: "offer"; data: TrackerOffer }
  | { type: "request"; data: TrackerRequest };

async function fetchTrackerData(userId: string) {
  const [offersResult, requestsResult, myOfferBidsResult, myReqBidsResult] =
    await Promise.all([
      getOffers({ user_id: userId }),
      getRequests({ user_id: userId }),
      getOfferBids({ bidder_id: userId }),
      getRequestBids({ bidder_id: userId }),
    ]);

  // Bids on my offers
  const offerBidFetches = (offersResult.data ?? []).map((offer) =>
    getOfferBids({ offer_id: offer.id }).then((r) => ({
      offer,
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

  // Offers I bid on (fetch each offer)
  const myOfferBids = myOfferBidsResult.data ?? [];
  const bidOfferFetches = myOfferBids.map((bid) =>
    getOffers({ id: bid.offer_id }).then((r) => ({
      bid,
      offer: r.data?.[0] ?? null,
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

  const [offerBidGroups, reqBidGroups, bidOfferGroups, bidReqGroups] =
    await Promise.all([
      Promise.all(offerBidFetches),
      Promise.all(reqBidFetches),
      Promise.all(bidOfferFetches),
      Promise.all(bidReqFetches),
    ]);

  // Collect all user IDs we need names for
  const userIds = new Set<string>();
  for (const { bids } of offerBidGroups)
    for (const bid of bids) userIds.add(bid.bidder_id);
  for (const { bids } of reqBidGroups)
    for (const bid of bids) userIds.add(bid.bidder_id);
  for (const { offer } of bidOfferGroups)
    if (offer?.user_id) userIds.add(offer.user_id);
  for (const { req } of bidReqGroups)
    if (req?.user_id) userIds.add(req.user_id);

  const usersMap = new Map<string, string>();
  if (userIds.size > 0) {
    const usersResult = await getUsers({ ids: Array.from(userIds) });
    for (const u of usersResult.data ?? [])
      usersMap.set(u.id, u.name ?? "User");
  }

  // My own offer IDs (to avoid duplicates)
  const myOfferIds = new Set((offersResult.data ?? []).map((p) => p.id));
  const myRequestIds = new Set((requestsResult.data ?? []).map((r) => r.id));

  // Cards for my offers (offers I own)
  const offerList: TrackerOffer[] = offerBidGroups.map(({ offer, bids }) => ({
    id: offer.id,
    itemName: offer.title,
    description: offer.description ?? null,
    imageUrl: offer.imgUrl ?? null,
    price: formatPrice(offer.price),
    type: offer.type ?? null,
    status: offer.status,
    isOwned: true,
    requesterCount: bids.length,
    requesters: bids.map((bid) => ({
      id: bid.bidder_id,
      name: usersMap.get(bid.bidder_id) ?? "User",
      bidId: bid.id,
      bidStatus: bid.status,
    })),
  }));

  // Cards for offers I bid on (not my own)
  for (const { bid, offer } of bidOfferGroups) {
    if (!offer || !offer.user_id || myOfferIds.has(offer.id)) continue;
    offerList.push({
      id: `bid-${bid.id}`,
      itemName: offer.title,
      description: offer.description ?? null,
      imageUrl: offer.imgUrl ?? null,
      price: formatPrice(offer.price),
      type: offer.type ?? null,
      status: offer.status,
      isOwned: false,
      requesterCount: 1,
      rawBidId: bid.id,
      requesters: [
        {
          id: offer.user_id,
          name: usersMap.get(offer.user_id) ?? "User",
          bidId: bid.id,
          bidStatus: bid.status,
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
      bidStatus: bid.status,
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
      rawBidId: bid.id,
      bidders: [
        {
          id: req.user_id,
          name: usersMap.get(req.user_id) ?? "User",
          bidId: bid.id,
          bidStatus: bid.status,
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "inquiries">("posts");
  const [modalData, setModalData] = useState<{
    id: string;
    title: string;
    people: { id: string; name: string; bidId: string }[];
    type: "offer" | "request";
    isHistory: boolean;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
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
    return () => {
      cancelled = true;
    };
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

  // Scope to active tab: Posts = owned, Inquiries = bid-on
  const tabOffers =
    activeTab === "posts"
      ? offers.filter((o) => o.isOwned)
      : offers.filter((o) => !o.isOwned);

  const tabRequests =
    activeTab === "posts"
      ? requests.filter((r) => r.isOwned)
      : requests.filter((r) => !r.isOwned);

  // Split active vs history
  const activeOffers =
    activeTab === "posts"
      ? tabOffers.filter((o) => o.status === "Active")
      : tabOffers.filter(
          (o) =>
            o.status === "Active" &&
            o.requesters.some((r) => r.bidStatus === "Pending"),
        );
  const historyOffers =
    activeTab === "posts"
      ? tabOffers.filter((o) => o.status === "Closed")
      : tabOffers.filter(
          (o) =>
            o.status !== "Active" ||
            o.requesters.every((r) => r.bidStatus !== "Pending"),
        );
  const activeRequests =
    activeTab === "posts"
      ? tabRequests.filter((r) => r.status !== "Completed")
      : tabRequests.filter(
          (r) =>
            r.status !== "Completed" &&
            r.bidders.some((b) => b.bidStatus === "Pending"),
        );
  const historyRequests =
    activeTab === "posts"
      ? tabRequests.filter((r) => r.status === "Completed")
      : tabRequests.filter(
          (r) =>
            r.status === "Completed" ||
            r.bidders.every((b) => b.bidStatus !== "Pending"),
        );

  const activeCards: TrackerCard[] = [
    ...filterOffers(activeOffers).map((data) => ({
      type: "offer" as const,
      data,
    })),
    ...filterRequests(activeRequests).map((data) => ({
      type: "request" as const,
      data,
    })),
  ];

  const historyCards: TrackerCard[] = [
    ...filterOffers(historyOffers).map((data) => ({
      type: "offer" as const,
      data,
    })),
    ...filterRequests(historyRequests).map((data) => ({
      type: "request" as const,
      data,
    })),
  ];

  const searchLower = searchQuery.trim().toLowerCase();

  const filteredActiveCards = searchLower
    ? activeCards.filter((c) =>
        c.data.itemName.toLowerCase().includes(searchLower),
      )
    : activeCards;

  const filteredHistoryCards = searchLower
    ? historyCards.filter((c) =>
        c.data.itemName.toLowerCase().includes(searchLower),
      )
    : historyCards;

  const sortCards = (cards: TrackerCard[]) => {
    const base = cards.map((card, i) => ({ card, i }));
    base.sort((a, b) => {
      if (priceSort) {
        const pA = a.card.data.price;
        const pB = b.card.data.price;
        const diff = getPriceRank(pA) - getPriceRank(pB);
        if (diff !== 0) return priceSort === "price-lowest" ? diff : -diff;
      }
      if (dateSort === "date-oldest") return b.i - a.i;
      return a.i - b.i;
    });
    return base.map(({ card }) => card);
  };

  const sortedActiveCards = sortCards(filteredActiveCards);
  const sortedHistoryCards = sortCards(filteredHistoryCards);

  const hasUnfilteredActiveCards =
    activeOffers.length > 0 || activeRequests.length > 0;

  const handleAddFilter = () => {
    const name = newFilterName.trim();
    if (name && !customFilters.includes(name)) {
      setCustomFilters((prev) => [...prev, name]);
      setActiveFilter(name);
      setNewFilterName("");
      setAddFilterOpen(false);
    }
  };

  const goToChat = async (
    bidId: string,
    kind: "offer" | "request",
    title: string,
    otherId: string,
  ) => {
    await markChatNotificationRead(bidId);
    router.push(
      `/chat?bidId=${encodeURIComponent(bidId)}&kind=${encodeURIComponent(kind)}&title=${encodeURIComponent(title)}&otherId=${encodeURIComponent(otherId)}`,
    );
  };

  const handleCloseOffer = (offerId: string) => {
    setConfirmModal({
      message: "Close this offer? All open inquiries will be ended.",
      onConfirm: async () => {
        const { error } = await closeOffer(offerId);
        if (error) {
          alert("Failed to close offer. Please try again.");
          return;
        }
        setOffers((prev) =>
          prev.map((o) => (o.id === offerId ? { ...o, status: "Closed" } : o)),
        );
      },
    });
  };

  const handleWithdrawOfferBid = (bidId: string) => {
    setConfirmModal({
      message: "Withdraw your inquiry?",
      onConfirm: async () => {
        const { error } = await withdrawOfferBid(bidId);
        if (error) {
          alert("Failed to withdraw. Please try again.");
          return;
        }
        setOffers((prev) =>
          prev.map((o) =>
            o.rawBidId === bidId
              ? {
                  ...o,
                  requesters: o.requesters.map((r) =>
                    r.bidId === bidId ? { ...r, bidStatus: "Closed" } : r,
                  ),
                }
              : o,
          ),
        );
      },
    });
  };

  const handleWithdrawRequestBid = (bidId: string) => {
    setConfirmModal({
      message: "Withdraw your bid?",
      onConfirm: async () => {
        const { error } = await withdrawRequestBid(bidId);
        if (error) {
          alert("Failed to withdraw. Please try again.");
          return;
        }
        setRequests((prev) =>
          prev.map((r) =>
            r.rawBidId === bidId
              ? {
                  ...r,
                  bidders: r.bidders.map((b) =>
                    b.bidId === bidId ? { ...b, bidStatus: "Closed" } : b,
                  ),
                }
              : r,
          ),
        );
      },
    });
  };

  const handleDeleteRequest = (requestId: string) => {
    setConfirmModal({
      message: "Are you sure you want to delete this item?",
      onConfirm: async () => {
        const { error } = await removeRequest(requestId);
        if (error) {
          alert("Failed to delete item. Please try again.");
          return;
        }
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      },
    });
  };

  const renderOfferCard = (card: TrackerOffer, isHistory: boolean) => {
    const counterparty = card.requesters[0];
    const activePeople = card.requesters.filter(
      (r) => isHistory || r.bidStatus !== "Closed",
    );
    const onClickHandler = card.isOwned
      ? () =>
          setModalData({
            id: card.id,
            title: card.itemName,
            people: activePeople,
            type: "offer",
            isHistory,
          })
      : counterparty
        ? () =>
            goToChat(
              counterparty.bidId,
              "offer",
              card.itemName,
              counterparty.id,
            )
        : undefined;

    return (
      <ItemRequestCard
        key={`offer-${card.id}`}
        variant="lent"
        requestedBy={
          card.isOwned
            ? "Offered by: You"
            : `Offered by: ${counterparty?.name ?? "User"}`
        }
        price={card.price}
        typeBadge="Offer"
        detail={{
          title: card.itemName,
          lentBy: card.isOwned ? "You" : (counterparty?.name ?? "User"),
          quantity: 1,
          price: card.price,
          description: card.description ?? undefined,
          imageUrl: card.imageUrl ?? undefined,
        }}
        onClick={onClickHandler}
        onEdit={
          !isHistory && card.isOwned
            ? () => router.push(`/create-offer?edit=${card.id}`)
            : undefined
        }
        onDelete={
          isHistory
            ? undefined
            : card.isOwned
              ? () => handleCloseOffer(card.id)
              : () => handleWithdrawOfferBid(card.rawBidId!)
        }
        deleteLabel={card.isOwned ? "Close" : "Withdraw"}
        deleteDestructive={false}
      />
    );
  };

  const renderRequestCard = (card: TrackerRequest, isHistory: boolean) => {
    const counterparty = card.bidders[0];
    const activePeople = card.bidders.filter(
      (b) => isHistory || b.bidStatus !== "Closed",
    );
    const onClickHandler = card.isOwned
      ? () =>
          setModalData({
            id: card.id,
            title: card.itemName,
            people: activePeople,
            type: "request",
            isHistory,
          })
      : counterparty
        ? () =>
            goToChat(
              counterparty.bidId,
              "request",
              card.itemName,
              counterparty.id,
            )
        : undefined;

    return (
      <ItemRequestCard
        key={`request-${card.id}`}
        variant="requested"
        requestedBy={
          card.isOwned
            ? "Requested by: You"
            : `Requested by: ${counterparty?.name ?? "User"}`
        }
        price={card.price}
        typeBadge="Request"
        detail={{
          title: card.itemName,
          requestedBy: card.isOwned ? "You" : (counterparty?.name ?? "User"),
          quantity: 1,
          price: card.price,
          description: card.description ?? undefined,
          imageUrl: card.imageUrl ?? undefined,
        }}
        onClick={onClickHandler}
        onEdit={
          !isHistory && card.isOwned
            ? () => router.push(`/create-request?edit=${card.id}`)
            : undefined
        }
        onDelete={
          isHistory
            ? undefined
            : card.isOwned
              ? () => handleDeleteRequest(card.id)
              : () => handleWithdrawRequestBid(card.rawBidId!)
        }
        deleteLabel={card.isOwned ? "Close" : "Withdraw"}
        deleteDestructive={false}
      />
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <SegmentedTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveFilter("All");
          setHistoryOpen(false);
        }}
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
            {/* Active cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {sortedActiveCards.map((card) =>
                card.type === "offer"
                  ? renderOfferCard(card.data, false)
                  : renderRequestCard(card.data, false),
              )}
            </div>

            {/* Empty state */}
            {sortedActiveCards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-gray-500">
                  {hasUnfilteredActiveCards
                    ? "No results match your current filters."
                    : activeTab === "posts"
                      ? "No posts yet. Create an offer or request to get started."
                      : "No inquiries yet. Browse listings to find something you need."}
                </p>
              </div>
            )}

            {/* History section */}
            {sortedHistoryCards.length > 0 && (
              <div className="max-w-7xl mx-auto w-full mt-6">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-2 w-full text-sm font-semibold text-gray-500 py-2 border-t border-gray-200"
                >
                  {historyOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  History ({sortedHistoryCards.length})
                </button>
                {historyOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3 grayscale opacity-60">
                    {sortedHistoryCards.map((card) =>
                      card.type === "offer"
                        ? renderOfferCard(card.data, true)
                        : renderRequestCard(card.data, true),
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {confirmModal && (
            <ConfirmModal
              message={confirmModal.message}
              onConfirm={confirmModal.onConfirm}
              onClose={() => setConfirmModal(null)}
            />
          )}

          {modalData && (
            <ChatListModal
              title={modalData.title}
              people={modalData.people}
              accentClass={
                modalData.type === "offer"
                  ? "bg-gray-50 hover:bg-gray-100"
                  : "bg-blue-50 hover:bg-blue-100"
              }
              avatarClass={
                modalData.type === "offer"
                  ? "bg-gray-300 text-gray-600"
                  : "bg-blue-200 text-blue-700"
              }
              iconClass={
                modalData.type === "offer" ? "text-gray-400" : "text-blue-400"
              }
              emptyLabel={
                modalData.type === "request" ? "No offers yet" : "No requests yet"
              }
              onSelect={(bidId, otherId) =>
                goToChat(bidId, modalData.type, modalData.title, otherId)
              }
              onClose={() => setModalData(null)}
              itemId={modalData.id}
              kind={modalData.type}
              onMarkDone={
                modalData.isHistory
                  ? undefined
                  : modalData.type === "request"
                  ? (bidId) => {
                      setConfirmModal({
                        message: "Mark this deal as done?",
                        onConfirm: async () => {
                          const { error } = await completeRequest(
                            modalData.id,
                            bidId,
                          );
                          if (error) {
                            alert("Failed. Please try again.");
                            return;
                          }
                          setModalData(null);
                          setRequests((prev) =>
                            prev.map((r) =>
                              r.id === modalData.id
                                ? { ...r, status: "Completed" }
                                : r,
                            ),
                          );
                        },
                      });
                    }
                  : (bidId) => {
                      setConfirmModal({
                        message: "Mark this deal as done?",
                        onConfirm: async () => {
                          const { error } = await completeOfferBid(bidId);
                          if (error) {
                            alert("Failed. Please try again.");
                            return;
                          }
                          setModalData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  people: prev.people.filter(
                                    (p) => p.bidId !== bidId,
                                  ),
                                }
                              : null,
                          );
                        },
                      });
                    }
              }
            />
          )}
        </main>
      )}

      <CreateFab />

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
  emptyLabel,
  onSelect,
  onClose,
  onMarkDone,
}: {
  title: string;
  people: { id: string; name: string; bidId: string }[];
  accentClass: string;
  avatarClass: string;
  iconClass: string;
  emptyLabel: string;
  onSelect: (bidId: string, id: string) => void;
  onClose: () => void;
  onMarkDone?: (bidId: string) => void;
  itemId?: string;
  kind?: "offer" | "request";
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
        {people.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">{emptyLabel}</p>
        )}
        <ul className="overflow-y-auto space-y-2">
          {people.map((p) => (
            <li key={p.bidId} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelect(p.bidId, p.id);
                  onClose();
                }}
                className={`flex-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${accentClass} transition-colors`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full ${avatarClass} flex items-center justify-center text-xs font-semibold`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {p.name}
                  </span>
                </div>
                <ChatDotsFill className={`shrink-0 ${iconClass}`} size={16} />
              </button>
              {onMarkDone && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkDone(p.bidId);
                  }}
                  className="shrink-0 text-xs font-medium border border-gray-300 rounded px-2 py-1 text-gray-600 hover:border-gray-500 transition-colors ml-1"
                >
                  Mark done
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SegmentedTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: "posts" | "inquiries";
  onTabChange: (tab: "posts" | "inquiries") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Tracker view"
      className="flex mx-4 mt-3 bg-gray-100 rounded-full p-1 md:bg-transparent md:rounded-none md:p-0 md:border-b md:border-gray-200 md:mx-auto md:mt-2 md:w-full"
    >
      {(["posts", "inquiries"] as const).map((tab) => (
        <button
          key={tab}
          role="tab"
          type="button"
          aria-selected={activeTab === tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-1.5 text-sm font-semibold transition-colors
            rounded-full md:rounded-none md:flex-none md:w-[50%] md:-mb-px
            ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm md:bg-transparent md:shadow-none md:border-b-2 md:border-blue-600 md:text-blue-600"
                : "text-gray-500 hover:text-gray-700 md:bg-transparent"
            }`}
        >
          {tab === "posts" ? "Posts" : "Inquiries"}
        </button>
      ))}
    </div>
  );
}

function ConfirmModal({
  message,
  onConfirm,
  onClose,
}: {
  message: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-gray-800 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onConfirm();
              setLoading(false);
              onClose();
            }}
            className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
