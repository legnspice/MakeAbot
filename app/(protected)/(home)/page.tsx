"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import ItemRequestCard from "@/components/ui/item";
import ItemDetailModal, {
  type ItemDetailData,
} from "@/components/ui/item-detail-modal";
import FilterBar, { type DateSort, type PriceSort } from "@/components/ui/filter-bar";
import { Plus, Tag, HelpCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getPosts, getPostBids, createPostBid } from "@/lib/actions/posts";
import {
  getRequests,
  getRequestBids,
  createRequestBid,
} from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";
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
};

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return "FREE";
  return `₱${value}`;
}

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
    getPosts({}),
    getRequests({}),
  ]);

  const userIds = new Set<string>();
  for (const post of postsResult.data ?? [])
    if (post.user_id && post.user_id !== userId) userIds.add(post.user_id);
  for (const req of requestsResult.data ?? [])
    if (req.user_id && req.user_id !== userId) userIds.add(req.user_id);

  const usersMap = new Map<string, string>();
  if (userIds.size > 0) {
    const usersResult = await getUsers({ ids: Array.from(userIds) });
    for (const u of usersResult.data ?? [])
      usersMap.set(u.id, u.name ?? "User");
  }

  const mapped: ListItem[] = [];

  for (const post of postsResult.data ?? []) {
    const posterName =
      post.user_id === userId
        ? (userName ?? "You")
        : (usersMap.get(post.user_id ?? "") ?? "User");
    mapped.push({
      id: post.id,
      itemDbId: post.id,
      userId: post.user_id ?? "",
      variant: "lent",
      requestedBy: `Offered by: ${posterName}`,
      price: formatPrice(post.price),
      typeBadge: "Offer",
      detail: {
        title: post.title,
        lentBy: posterName,
        quantity: 1,
        price: formatPrice(post.price),
        description: post.description ?? undefined,
        imageUrl: post.imgUrl ?? undefined,
      },
    });
  }

  for (const req of requestsResult.data ?? []) {
    const posterName =
      req.user_id === userId
        ? (userName ?? "You")
        : (usersMap.get(req.user_id ?? "") ?? "User");
    mapped.push({
      id: req.id,
      itemDbId: req.id,
      userId: req.user_id ?? "",
      variant: "requested",
      requestedBy: `Requested by: ${posterName}`,
      price: formatPrice(req.fee),
      typeBadge: "Request",
      detail: {
        title: req.title,
        requestedBy: posterName,
        quantity: 1,
        price: formatPrice(req.fee),
        description: req.description ?? undefined,
        imageUrl: req.imgUrl ?? undefined,
      },
    });
  }

  return mapped;
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
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

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
      const existing = await getPostBids({
        post_id: item.itemDbId,
        bidder_id: currentUser.id,
      });
      if (existing.data && existing.data.length > 0) {
        bidId = existing.data[0].id;
      } else {
        await createPostBid({
          post_id: item.itemDbId,
          bidder_id: currentUser.id,
        });
        const created = await getPostBids({
          post_id: item.itemDbId,
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
      <Navbar
        onSearchToggle={() => setSearchOpen((o) => !o)}
        searchOpen={searchOpen}
      />

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {filteredItems.map((item) => {
                const isOwn = item.userId === currentUser.id;
                return (
                  <ItemRequestCard
                    key={item.id}
                    variant={item.variant}
                    requestedBy={item.requestedBy}
                    section={item.section}
                    time={item.time}
                    price={item.price}
                    typeBadge={item.typeBadge}
                    detail={item.detail}
                    onClick={isOwn ? undefined : () => setSelectedItem(item)}
                  />
                );
              })}
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
        />

        {/* Type picker modal */}
        {isTypePickerOpen && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/40"
              onClick={() => setIsTypePickerOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
              <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 px-6 pt-5 pb-8">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-800">
                    What are you creating?
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsTypePickerOpen(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Options */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Offer */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsTypePickerOpen(false);
                      router.push("/create-offer");
                    }}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#E5A550] hover:bg-amber-50 active:bg-amber-100 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                      <Tag className="w-6 h-6 text-[#E5A550]" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-800 text-sm">
                        Offer
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        I have something to share
                      </div>
                    </div>
                  </button>

                  {/* Request */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsTypePickerOpen(false);
                      router.push("/create-request");
                    }}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#3761B0] hover:bg-blue-50 active:bg-blue-100 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                      <HelpCircle className="w-6 h-6 text-[#3761B0]" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-800 text-sm">
                        Request
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        I need something
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating action button */}
        <Button
          size="icon"
          className="font-bold text-lg fixed bottom-30 md:bottom-6 right-6 w-32 h-14 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white shadow-lg z-10 p-0 flex items-center justify-center"
          aria-label="Create item"
          onClick={() => setIsTypePickerOpen(true)}
        >
          Create <Plus className="w-12 h-12 shrink-0" strokeWidth={2.5} />
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
