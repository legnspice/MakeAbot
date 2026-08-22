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
import { removeOffer, withdrawOfferBid } from "@/lib/actions/offers";
import { removeRequest, withdrawRequestBid } from "@/lib/actions/requests";
import { getTrackerData } from "@/lib/actions/tracker";
import {
  ChatDotsFill,
  XLg,
  ChevronDown,
  ChevronRight,
} from "react-bootstrap-icons";
import ItemRequestCard from "@/components/ui/item";
import CreateFab from "@/components/create-fab";
import { formatIncentive } from "@/lib/incentive";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { sumUnreadForBids } from "@/lib/unread";
import { markChatNotificationRead } from "@/lib/actions/notifications";
import {
  closeOffer,
  closeRequest,
  completeOfferBid,
  dismissOfferBid,
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

/**
 * Bid statuses whose chat thread stays reachable from a non-history card.
 *
 * The active/history split is per CARD (listing status, or "some bid still
 * Pending"); this is per THREAD, and the two do not line up. An offer
 * deliberately stays Active after a completed transaction, so a Completed
 * thread on an Active offer has no other route in the tracker — filtering it
 * out of the chat list stranded the owner outside the only chat where they
 * could leave a review, and stopped its unread count being visible at all.
 *
 * Completed threads therefore stay reachable but visually separated
 * (ChatListModal renders them under their own heading). Closed threads — the
 * dismissed and swept-up ones, with no review to exchange — stay hidden on
 * non-history cards. A history card shows everything.
 */
const REACHABLE_THREAD_STATUSES = ["Pending", "Completed"];

function isReachableThread(bidStatus: string, isHistory: boolean): boolean {
  return isHistory || REACHABLE_THREAD_STATUSES.includes(bidStatus);
}

type TrackerCard =
  | { type: "offer"; data: TrackerOffer }
  | { type: "request"; data: TrackerRequest };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature kept for call-site compatibility; aggregate derives the user server-side
async function fetchTrackerData(userId: string) {
  const result = await getTrackerData();
  const data = result.data;
  if (!data)
    return { offerList: [] as TrackerOffer[], requestList: [] as TrackerRequest[] };
  const { offerBidGroups, reqBidGroups, bidOfferGroups, bidReqGroups, userNames } =
    data;

  const myOfferIds = new Set(offerBidGroups.map((g) => g.offer.id));
  const myRequestIds = new Set(reqBidGroups.map((g) => g.req.id));

  // Cards for my offers (offers I own)
  const offerList: TrackerOffer[] = offerBidGroups.map(({ offer, bids }) => ({
    id: offer.id,
    itemName: offer.title,
    description: offer.description ?? null,
    imageUrl: offer.imgUrl ?? null,
    price: formatIncentive(offer.incentive),
    type: offer.type ?? null,
    status: offer.status,
    isOwned: true,
    requesterCount: bids.length,
    requesters: bids.map((bid) => ({
      id: bid.bidder_id,
      name: userNames[bid.bidder_id] ?? "User",
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
      price: formatIncentive(offer.incentive),
      type: offer.type ?? null,
      status: offer.status,
      isOwned: false,
      requesterCount: 1,
      rawBidId: bid.id,
      requesters: [
        {
          id: offer.user_id,
          name: userNames[offer.user_id] ?? "User",
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
    price: formatIncentive(req.incentive),
    type: req.type ?? null,
    urgency: req.urgency ?? null,
    isOwned: true,
    bidders: bids.map((bid) => ({
      id: bid.bidder_id,
      name: userNames[bid.bidder_id] ?? "User",
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
      price: formatIncentive(req.incentive),
      type: req.type ?? null,
      urgency: req.urgency ?? null,
      isOwned: false,
      rawBidId: bid.id,
      bidders: [
        {
          id: req.user_id,
          name: userNames[req.user_id] ?? "User",
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
  const { unreadByContext } = useUnreadCounts();

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
    people: { id: string; name: string; bidId: string; bidStatus: string }[];
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
      ? tabRequests.filter((r) => r.status === "Active")
      : tabRequests.filter(
          (r) =>
            r.status !== "Completed" &&
            r.bidders.some((b) => b.bidStatus === "Pending"),
        );
  const historyRequests =
    activeTab === "posts"
      ? tabRequests.filter((r) => r.status !== "Active")
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
          alert(error);
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
          alert(error);
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
          alert(error);
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

  const handleCloseRequest = (requestId: string) => {
    setConfirmModal({
      message:
        "Close this request? All open inquiries will be closed, and everyone you've spoken with can leave a review.",
      onConfirm: async () => {
        const { error } = await closeRequest(requestId);
        if (error) {
          alert(error);
          return;
        }
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, status: "Completed" } : r,
          ),
        );
      },
    });
  };

  const handleDeleteRequest = (requestId: string) => {
    setConfirmModal({
      message:
        "Delete this request? It and its messages will be removed. Reviews you've given and received stay on both profiles.",
      onConfirm: async () => {
        const { error } = await removeRequest(requestId);
        if (error) {
          alert(error);
          return;
        }
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      },
    });
  };

  const handleDeleteOffer = (offerId: string) => {
    setConfirmModal({
      message:
        "Delete this offer? It and its messages will be removed. Reviews you've given and received stay on both profiles.",
      onConfirm: async () => {
        const { error } = await removeOffer(offerId);
        if (error) {
          alert(error);
          return;
        }
        setOffers((prev) => prev.filter((o) => o.id !== offerId));
      },
    });
  };

  const renderOfferCard = (card: TrackerOffer, isHistory: boolean) => {
    const counterparty = card.requesters[0];
    const chatPeople = card.requesters.filter((r) =>
      isReachableThread(r.bidStatus, isHistory),
    );
    const onClickHandler = card.isOwned
      ? () =>
          setModalData({
            id: card.id,
            title: card.itemName,
            people: chatPeople,
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
        badgeCount={sumUnreadForBids(
          unreadByContext,
          chatPeople.map((p) => p.bidId),
        )}
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
          card.status === "Active" && card.isOwned
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
    const chatPeople = card.bidders.filter((b) =>
      isReachableThread(b.bidStatus, isHistory),
    );
    const onClickHandler = card.isOwned
      ? () =>
          setModalData({
            id: card.id,
            title: card.itemName,
            people: chatPeople,
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
        badgeCount={sumUnreadForBids(
          unreadByContext,
          chatPeople.map((p) => p.bidId),
        )}
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
          card.status === "Active" && card.isOwned
            ? () => router.push(`/create-request?edit=${card.id}`)
            : undefined
        }
        onDelete={
          isHistory
            ? undefined
            : card.isOwned
              ? () => handleCloseRequest(card.id)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-7xl mx-auto">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 grayscale opacity-60">
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
              unreadByBid={unreadByContext}
              onSelect={(bidId, otherId) =>
                goToChat(bidId, modalData.type, modalData.title, otherId)
              }
              onClose={() => setModalData(null)}
              itemId={modalData.id}
              kind={modalData.type}
              deleteItemLabel={
                modalData.type === "offer" ? "Delete offer" : "Delete request"
              }
              onDeleteItem={() => {
                const id = modalData.id;
                const kind = modalData.type;
                setModalData(null);
                if (kind === "offer") {
                  handleDeleteOffer(id);
                } else {
                  handleDeleteRequest(id);
                }
              }}
              onMarkDone={
                modalData.isHistory || modalData.type === "request"
                  ? undefined
                  : (bidId) => {
                      setConfirmModal({
                        message: "Mark this deal as done?",
                        onConfirm: async () => {
                          const { error } = await completeOfferBid(bidId);
                          if (error) {
                            alert(error);
                            return;
                          }
                          // Move the thread to Completed rather than dropping
                          // it: the owner still needs a way back in to leave a
                          // review, and the offer itself stays Active so the
                          // card will not move to History to carry it.
                          const toCompleted = <
                            T extends { bidId: string; bidStatus: string },
                          >(
                            list: T[],
                          ) =>
                            list.map((p) =>
                              p.bidId === bidId
                                ? { ...p, bidStatus: "Completed" }
                                : p,
                            );
                          setModalData((prev) =>
                            prev
                              ? { ...prev, people: toCompleted(prev.people) }
                              : null,
                          );
                          setOffers((prev) =>
                            prev.map((o) =>
                              o.id === modalData.id
                                ? {
                                    ...o,
                                    requesters: toCompleted(o.requesters),
                                  }
                                : o,
                            ),
                          );
                        },
                      });
                    }
              }
              onDismiss={
                modalData.isHistory || modalData.type !== "offer"
                  ? undefined
                  : (bidId) => {
                      setConfirmModal({
                        message: "Dismiss this inquiry? No review will be exchanged.",
                        onConfirm: async () => {
                          const { error } = await dismissOfferBid(bidId);
                          if (error) {
                            alert(error);
                            return;
                          }
                          setModalData((prev) =>
                            prev
                              ? { ...prev, people: prev.people.filter((p) => p.bidId !== bidId) }
                              : null,
                          );
                        },
                      });
                    }
              }
            />
          )}

          {confirmModal && (
            <ConfirmModal
              message={confirmModal.message}
              onConfirm={confirmModal.onConfirm}
              onClose={() => setConfirmModal(null)}
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
  unreadByBid,
  onSelect,
  onClose,
  onMarkDone,
  onDismiss,
  onDeleteItem,
  deleteItemLabel,
}: {
  title: string;
  people: { id: string; name: string; bidId: string; bidStatus: string }[];
  accentClass: string;
  avatarClass: string;
  iconClass: string;
  emptyLabel: string;
  unreadByBid: Record<string, number>;
  onSelect: (bidId: string, id: string) => void;
  onClose: () => void;
  onMarkDone?: (bidId: string) => void;
  onDismiss?: (bidId: string) => void;
  onDeleteItem?: () => void;
  deleteItemLabel?: string;
  itemId?: string;
  kind?: "offer" | "request";
}) {
  // Live threads first; finished ones stay reachable but out of the way.
  // `Closed`/other statuses only ever reach here on a history card, where
  // there is no live/finished distinction to draw — group them with Pending.
  const completedPeople = people.filter((p) => p.bidStatus === "Completed");
  const livePeople = people.filter((p) => p.bidStatus !== "Completed");

  const renderPerson = (p: (typeof people)[number]) => {
    const isPending = p.bidStatus === "Pending";
    const hasActions = (onMarkDone || onDismiss) && isPending;
    return (
      <li
        key={p.bidId}
        className="flex flex-col sm:flex-row sm:items-center gap-1 min-w-0"
      >
        <button
          type="button"
          onClick={() => {
            onSelect(p.bidId, p.id);
            onClose();
          }}
          className={`min-w-0 flex-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${accentClass} transition-colors`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-7 h-7 shrink-0 rounded-full ${avatarClass} flex items-center justify-center text-xs font-semibold`}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-gray-800 truncate min-w-0">
              {p.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadByBid[p.bidId] > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadByBid[p.bidId] > 99 ? "99+" : unreadByBid[p.bidId]}
              </span>
            )}
            <ChatDotsFill className={iconClass} size={16} />
          </div>
        </button>
        {hasActions && (
          <div className="flex items-center gap-2 w-full justify-end sm:w-auto shrink-0">
            {onMarkDone && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkDone(p.bidId);
                }}
                className="shrink-0 text-xs font-medium border border-gray-300 rounded px-2 py-1 text-gray-600 hover:border-gray-500 transition-colors"
              >
                Close transaction
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(p.bidId);
                }}
                className="shrink-0 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-1 py-1"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg min-w-0 bg-white rounded-2xl shadow-xl p-5 max-h-[70vh] flex flex-col"
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
        <div className="overflow-y-auto min-w-0">
          <ul className="space-y-2">{livePeople.map(renderPerson)}</ul>
          {completedPeople.length > 0 && (
            <>
              <p className="mt-4 mb-2 pt-3 border-t border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Completed
              </p>
              <ul className="space-y-2">{completedPeople.map(renderPerson)}</ul>
            </>
          )}
        </div>
        {onDeleteItem && (
          <button
            type="button"
            onClick={onDeleteItem}
            className="mt-4 pt-3 border-t border-gray-100 w-full text-center text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            {deleteItemLabel ?? "Delete"}
          </button>
        )}
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-2xl shadow-xl p-5"
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
