"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ItemRequestCard from "@/components/ui/item";
import ItemDetailModal, { type ItemDetailData } from "@/components/ui/item-detail-modal";
import FilterBar, { type SortOption } from "@/components/ui/filter-bar";
import { Plus, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getPosts, createPost, getPostBids, createPostBid } from "@/lib/actions/posts";
import { getRequests, createRequest, getRequestBids, createRequestBid } from "@/lib/actions/requests";
import { getUsers } from "@/lib/actions/users";

type ListItem = {
  id: string;
  itemDbId: string;
  userId: string;
  variant: "lent" | "requested";
  requestedBy: string;
  section?: string;
  time?: string;
  price: string;
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

export default function Home() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"offer" | "request">("request");
  const [itemKind, setItemKind] = useState<"item" | "service">("item");
  const [isPosting, setIsPosting] = useState(false);
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    count: 1,
    preferredTime: "",
    preferredVenue: "",
    monetaryIncentive: "",
    notesForRenter: "",
  });

  const loadItems = useCallback(async () => {
    const [postsResult, requestsResult] = await Promise.all([
      getPosts({}),
      getRequests({}),
    ]);

    const mapped: ListItem[] = [];

    if (postsResult.data) {
      for (const post of postsResult.data) {
        let posterName = currentUser.name ?? "You";
        if (post.user_id !== currentUser.id) {
          const userResult = await getUsers({ id: post.user_id ?? "" });
          posterName = userResult.data?.[0]?.name ?? "User";
        }
        mapped.push({
          id: post.id,
          itemDbId: post.id,
          userId: post.user_id ?? "",
          variant: "lent",
          requestedBy: `Offered by: ${posterName}`,
          price: formatPrice(post.price),
          detail: {
            title: post.title,
            lentBy: posterName,
            quantity: 1,
            price: formatPrice(post.price),
            description: post.description ?? undefined,
          },
        });
      }
    }

    if (requestsResult.data) {
      for (const req of requestsResult.data) {
        let posterName = currentUser.name ?? "You";
        if (req.user_id !== currentUser.id) {
          const userResult = await getUsers({ id: req.user_id ?? "" });
          posterName = userResult.data?.[0]?.name ?? "User";
        }
        mapped.push({
          id: req.id,
          itemDbId: req.id,
          userId: req.user_id ?? "",
          variant: "requested",
          requestedBy: `Requested by: ${posterName}`,
          price: formatPrice(req.fee),
          detail: {
            title: req.title,
            requestedBy: posterName,
            quantity: 1,
            price: formatPrice(req.fee),
            description: req.description ?? undefined,
          },
        });
      }
    }

    setItems(mapped);
  }, [currentUser.id, currentUser.name]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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

  const filteredItems =
    sortBy === "date"
      ? [...afterSearch]
      : [...afterSearch].sort(
          (a, b) => getPriceRank(a.price) - getPriceRank(b.price),
        );

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

  const resetForm = () => {
    setForm({
      itemName: "",
      description: "",
      count: 1,
      preferredTime: "",
      preferredVenue: "",
      monetaryIncentive: "",
      notesForRenter: "",
    });
    setCreateType("request");
    setItemKind("item");
  };

  const handlePost = async () => {
    const title =
      form.itemName.trim() ||
      (createType === "offer" ? "New offer" : "New request");
    const prefix = itemKind === "service" ? "[Service] " : "";
    const fullTitle = prefix + title;
    const priceValue = form.monetaryIncentive.trim()
      ? parseInt(form.monetaryIncentive.trim(), 10) || null
      : null;

    setIsPosting(true);
    try {
      if (createType === "offer") {
        await createPost({
          user_id: currentUser.id,
          title: fullTitle,
          price: priceValue,
          description: form.description.trim() || null,
          imgUrl: null,
          status: "Active",
        });
      } else {
        await createRequest({
          user_id: currentUser.id,
          title: fullTitle,
          fee: priceValue,
          description: form.description.trim() || null,
          urgency: "Now",
          status: "Active",
        });
      }
      await loadItems();
      setIsCreateOpen(false);
      resetForm();
    } finally {
      setIsPosting(false);
    }
  };

  const handleInquire = async (item: ListItem) => {
    const kind = item.variant === "lent" ? "offer" : "request";
    const title = item.detail.title ?? "ITEM";

    // Find or create a bid
    let bidId: string | null = null;

    if (kind === "offer") {
      const existing = await getPostBids({
        post_id: item.itemDbId,
        bidder_id: currentUser.id,
      });
      if (existing.data && existing.data.length > 0) {
        bidId = existing.data[0].id;
      } else {
        await createPostBid({ post_id: item.itemDbId, bidder_id: currentUser.id });
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
        await createRequestBid({ request_id: item.itemDbId, bidder_id: currentUser.id });
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
      <Navbar onSearchToggle={() => setSearchOpen((o) => !o)} searchOpen={searchOpen} />

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
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortModalOpen={sortMenuOpen}
          onSortModalOpenChange={setSortMenuOpen}
          showSearch={searchOpen}
          onSearchToggle={() => setSearchOpen((open) => !open)}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        <main className="px-4 py-6 pb-28 md:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
            {filteredItems.map((item) => (
              <ItemRequestCard
                key={item.id}
                variant={item.variant}
                requestedBy={item.requestedBy}
                section={item.section}
                time={item.time}
                price={item.price}
                detail={item.detail}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </main>

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

        {/* Create request/offer modal */}
        {isCreateOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-20 bg-black/40"
              onClick={() => { setIsCreateOpen(false); resetForm(); }}
              aria-hidden
            />
            {/* Modal panel: leaves navbar + bottom nav visible on mobile */}
            <div className="fixed inset-x-0 top-32 bottom-36 md:inset-0 md:flex md:items-center md:justify-center z-30">
              <div className="bg-white rounded-2xl md:shadow-2xl md:w-full md:max-w-lg md:max-h-[85vh] border border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.16)] overflow-hidden flex flex-col h-full md:h-auto mx-4 md:mx-0">
            <div className="max-w-md mx-auto flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide w-full">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="relative z-10 shrink-0 p-2 rounded-full hover:bg-gray-100"
                  aria-label="Close create item form"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 flex items-center justify-center gap-2 -ml-8">
                  <span className="text-sm font-semibold text-gray-800">
                    Create an
                  </span>
                  <div className="inline-flex rounded-full bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setCreateType("offer")}
                      className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                        createType === "offer"
                          ? "bg-gray-700 text-white font-medium"
                          : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateType("request")}
                      className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                        createType === "request"
                          ? "bg-gray-700 text-white font-medium"
                          : "text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Request
                    </button>
                  </div>
                </div>

                <div className="w-9" />
              </div>

              {/* Form */}
              <div className="px-4 pt-1 pb-4 space-y-2">
                {/* Type: Item / Service */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">Type</div>
                  <div className="inline-flex rounded-full bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setItemKind("item")}
                      className={`px-3 py-1.5 text-sm rounded-full ${
                        itemKind === "item"
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "text-gray-600"
                      }`}
                    >
                      Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemKind("service")}
                      className={`px-3 py-1.5 text-sm rounded-full ${
                        itemKind === "service"
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "text-gray-600"
                      }`}
                    >
                      Service
                    </button>
                  </div>
                </div>

                {/* Item name */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">Item</div>
                  <Input
                    value={form.itemName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, itemName: e.target.value }))
                    }
                    placeholder="What do you need?"
                    className="flex-1 rounded-xl bg-gray-100 border-0"
                  />
                </div>

                {/* Description */}
                <div className="flex items-start gap-3">
                  <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                    Description
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={4}
                    className="flex-1 rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Add more details about your item or request..."
                  />
                </div>

                {/* Count */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">Count</div>
                  <Input
                    type="number"
                    min={1}
                    value={form.count}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        count: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-24 rounded-xl bg-gray-100 border-0"
                  />
                </div>

                {/* Preferred Time and Venue */}
                <div className="flex items-start gap-3">
                  <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                    Preferred Time and Venue
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <Input
                      value={form.preferredTime}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, preferredTime: e.target.value }))
                      }
                      placeholder="e.g. Today, 5 PM"
                      className="w-full rounded-xl bg-gray-100 border-0"
                    />
                    <Input
                      value={form.preferredVenue}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, preferredVenue: e.target.value }))
                      }
                      placeholder="e.g. SEC-A206"
                      className="w-full rounded-xl bg-gray-100 border-0"
                    />
                  </div>
                </div>

                {/* Monetary Incentive */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    {createType === "offer" ? "Price (₱)" : "Fee (₱)"}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={form.monetaryIncentive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, monetaryIncentive: e.target.value }))
                    }
                    placeholder="Leave empty for FREE"
                    className="flex-1 rounded-xl bg-gray-100 border-0"
                  />
                </div>

                {/* Notes for renter */}
                <div className="flex items-start gap-3">
                  <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                    Notes
                  </div>
                  <textarea
                    value={form.notesForRenter}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notesForRenter: e.target.value }))
                    }
                    rows={2}
                    className="flex-1 rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Anything else they should know?"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handlePost}
                    disabled={isPosting}
                    className="w-full rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white font-bold uppercase disabled:opacity-60"
                  >
                    {isPosting ? "Posting..." : "POST!"}
                  </Button>
                </div>
              </div>
            </div>
              </div>
            </div>
          </>
        )}

        {/* Floating action button */}
        {!isCreateOpen && (
          <Button
            size="icon"
            className="fixed bottom-30 md:bottom-6 right-6 w-14 h-14 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white shadow-lg z-30 p-0 flex items-center justify-center"
            aria-label="Add item"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-12 h-12 shrink-0" strokeWidth={2.5} />
          </Button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
