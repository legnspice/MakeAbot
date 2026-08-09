"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import ItemRequestCard from "@/components/ui/item";
import CreateFab from "@/components/create-fab";
import ItemDetailModal, {
  type ItemDetailData,
} from "@/components/ui/item-detail-modal";
import FilterBar, {
  type DateSort,
  type PriceSort,
} from "@/components/ui/filter-bar";
import ReportModal, { type ReportTarget } from "@/components/report-modal";
import { useAuth } from "@/contexts/auth-context";
import {
  getOffers,
  getOfferBids,
  createOfferBid,
  reopenOfferBid,
} from "@/lib/actions/offers";
import {
  getRequests,
  getRequestBids,
  createRequestBid,
  reopenRequestBid,
} from "@/lib/actions/requests";
import { getPublicUsers } from "@/lib/actions/users";
import { excludeOwnItems } from "@/lib/feed";
import { formatIncentive } from "@/lib/incentive";
import { HomePageSkeleton } from "@/components/ui/skeletons/home-skeleton";

type ListItem = {
  id: string;
  itemDbId: string;
  userId: string;
  variant: "lent" | "requested";
  requestedBy: string;
  section?: string;
  time?: string;
  price: string;
  typeBadge?: string;
  detail: ItemDetailData;
  posterId: string;
  posterName: string;
  posterAvatarUrl?: string;
  isOwnPoster: boolean;
};

function getPriceRank(price: string): number {
  const p = price.toUpperCase();
  if (p === "FREE") return 0;
  if (p.startsWith("₱")) return parseInt(p.slice(1), 10) || 1;
  if (p === "$") return 1;
  if (p === "$$") return 2;
  if (p === "$$$") return 3;
  return 4;
}

async function fetchHomeItems(
  userId: string,
  userName: string | null | undefined,
) {
  const [postsResult, requestsResult] = await Promise.all([
    getOffers({ status: "Active" }),
    getRequests({ status: "Active" }),
  ]);

  const userIds = new Set<string>();
  for (const post of postsResult.data ?? [])
    if (post.user_id && post.user_id !== userId) userIds.add(post.user_id);
  for (const req of requestsResult.data ?? [])
    if (req.user_id && req.user_id !== userId) userIds.add(req.user_id);

  const usersMap = new Map<string, { name: string; avatarUrl?: string }>();
  if (userIds.size > 0) {
    const usersResult = await getPublicUsers(Array.from(userIds));
    for (const u of usersResult.data ?? [])
      usersMap.set(u.id, {
        name: u.name ?? "User",
        avatarUrl: u.avatar_url ?? undefined,
      });
  }

  const mapped: ListItem[] = [];

  for (const post of postsResult.data ?? []) {
    const isOwn = post.user_id === userId;
    const entry = usersMap.get(post.user_id ?? "");
    const posterName = isOwn ? (userName ?? "You") : (entry?.name ?? "User");
    mapped.push({
      id: post.id,
      itemDbId: post.id,
      userId: post.user_id ?? "",
      variant: "lent",
      requestedBy: `Offered by: ${posterName}`,
      price: formatIncentive(post.incentive),
      typeBadge: "Offer",
      posterId: post.user_id ?? "",
      posterName,
      posterAvatarUrl: isOwn ? undefined : entry?.avatarUrl,
      isOwnPoster: isOwn,
      detail: {
        title: post.title,
        lentBy: posterName,
        quantity: 1,
        price: formatIncentive(post.incentive),
        description: post.description ?? undefined,
        imageUrl: post.imgUrl ?? undefined,
        posterId: post.user_id ?? undefined,
      },
    });
  }

  for (const req of requestsResult.data ?? []) {
    const isOwn = req.user_id === userId;
    const entry = usersMap.get(req.user_id ?? "");
    const posterName = isOwn ? (userName ?? "You") : (entry?.name ?? "User");
    mapped.push({
      id: req.id,
      itemDbId: req.id,
      userId: req.user_id ?? "",
      variant: "requested",
      requestedBy: `Requested by: ${posterName}`,
      price: formatIncentive(req.incentive),
      typeBadge: "Request",
      posterId: req.user_id ?? "",
      posterName,
      posterAvatarUrl: isOwn ? undefined : entry?.avatarUrl,
      isOwnPoster: isOwn,
      detail: {
        title: req.title,
        requestedBy: posterName,
        quantity: 1,
        price: formatIncentive(req.incentive),
        description: req.description ?? undefined,
        imageUrl: req.imgUrl ?? undefined,
        urgency: req.urgency ?? undefined,
        posterId: req.user_id ?? undefined,
      },
    });
  }

  return excludeOwnItems(mapped, userId);
}

export default function Home() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [dateSort, setDateSort] = useState<DateSort | null>(null);
  const [priceSort, setPriceSort] = useState<PriceSort | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHomeItems(currentUser.id, currentUser.name).then((mapped) => {
      if (!cancelled) {
        setItems(mapped);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser.id, currentUser.name]);

  const filterByCategory =
    activeFilter === "All"
      ? items
      : activeFilter === "Offers"
        ? items.filter((item) => item.variant === "lent")
        : activeFilter === "Requests"
          ? items.filter((item) => item.variant === "requested")
          : items.filter((item) =>
              item.detail.title
                .toLowerCase()
                .includes(activeFilter.toLowerCase()),
            );

  const searchLower = searchQuery.trim().toLowerCase();
  const afterSearch = searchLower
    ? filterByCategory.filter((item) =>
        item.detail.title.toLowerCase().includes(searchLower),
      )
    : filterByCategory;

  const filteredItems = (() => {
    const base = afterSearch.map((item, i) => ({ item, i }));
    base.sort((a, b) => {
      if (priceSort) {
        const diff = getPriceRank(a.item.price) - getPriceRank(b.item.price);
        if (diff !== 0) return priceSort === "price-lowest" ? diff : -diff;
      }
      if (dateSort === "date-oldest") return b.i - a.i;
      return a.i - b.i; // date-newest / default
    });
    return base.map(({ item }) => item);
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

  const allFilterLabels = ["All", "Offers", "Requests", ...customFilters];

  const handleInquire = async (item: ListItem) => {
    const kind = item.variant === "lent" ? "offer" : "request";
    const title = item.detail.title ?? "ITEM";

    let bidId: string | null = null;

    if (kind === "offer") {
      const existing = await getOfferBids({
        offer_id: item.itemDbId,
        bidder_id: currentUser.id,
      });
      if (existing.data && existing.data.length > 0) {
        bidId = existing.data[0].id;
        if (existing.data[0].status === "Closed") {
          await reopenOfferBid(bidId);
        }
      } else {
        await createOfferBid({
          offer_id: item.itemDbId,
          bidder_id: currentUser.id,
        });
        const created = await getOfferBids({
          offer_id: item.itemDbId,
          bidder_id: currentUser.id,
        });
        bidId = created.data?.[0]?.id ?? null;
      }
    } else {
      const existing = await getRequestBids({
        request_id: item.itemDbId,
        bidder_id: currentUser.id,
      });
      if (existing.data && existing.data.length > 0) {
        bidId = existing.data[0].id;
        if (existing.data[0].status === "Closed") {
          await reopenRequestBid(bidId);
        }
      } else {
        await createRequestBid({
          request_id: item.itemDbId,
          bidder_id: currentUser.id,
        });
        const created = await getRequestBids({
          request_id: item.itemDbId,
          bidder_id: currentUser.id,
        });
        bidId = created.data?.[0]?.id ?? null;
      }
    }

    if (!bidId) return;

    router.push(
      `/chat?bidId=${encodeURIComponent(bidId)}&kind=${encodeURIComponent(kind)}&title=${encodeURIComponent(title)}&otherId=${encodeURIComponent(item.userId)}`,
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="relative">
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
          sortModalOpen={sortMenuOpen}
          onSortModalOpenChange={setSortMenuOpen}
          showSearch={searchOpen}
          onSearchToggle={() => setSearchOpen((open) => !open)}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        {isLoading ? (
          <HomePageSkeleton />
        ) : (
          <main className="px-4 py-6 pb-28 md:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-7xl mx-auto">
              {filteredItems.map((item) => (
                <ItemRequestCard
                  key={item.id}
                  variant={item.variant}
                  requestedBy={item.requestedBy}
                  section={item.section}
                  time={item.time}
                  price={item.price}
                  typeBadge={item.typeBadge}
                  urgency={item.detail.urgency}
                  posterId={item.posterId}
                  posterName={item.posterName}
                  posterAvatarUrl={item.posterAvatarUrl}
                  isOwnPoster={item.isOwnPoster}
                  detail={item.detail}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </main>
        )}

        {/* Item detail modal */}
        <ItemDetailModal
          item={selectedItem?.detail ?? null}
          isOwner={selectedItem?.userId === currentUser.id}
          onClose={() => setSelectedItem(null)}
          onInquire={() => {
            if (selectedItem) {
              setSelectedItem(null);
              handleInquire(selectedItem);
            }
          }}
          onChatClick={() => {
            setSelectedItem(null);
            router.push("/tracker");
          }}
          onReport={
            selectedItem
              ? () =>
                  setReportTarget({
                    type: selectedItem.variant === "lent" ? "offer" : "request",
                    id: selectedItem.itemDbId,
                    label: selectedItem.detail.title,
                  })
              : undefined
          }
        />

        <ReportModal
          open={reportTarget !== null}
          onClose={() => setReportTarget(null)}
          target={reportTarget}
        />

        <CreateFab />
      </div>

      <BottomNav />
    </div>
  );
}
