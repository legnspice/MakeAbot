"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ItemRequestCard from "@/components/ui/item";
import { type ItemDetailData } from "@/components/ui/item-detail-modal";
import FilterBar, { type SortOption } from "@/components/ui/filter-bar";
import { Plus, ChevronLeft } from "lucide-react";

type ListItem = {
  id: string;
  variant: "lent" | "requested";
  requestedBy: string;
  section?: string;
  time?: string;
  price: string;
  detail: ItemDetailData;
};

const INITIAL_ITEMS: ListItem[] = [
  {
    id: "1",
    variant: "lent",
    requestedBy: "Offered by: Provider name",
    section: "SEC-A206",
    time: "5:00 P.M.",
    price: "FREE",
    detail: {
      title: "Lorem Ipsum item",
      lentBy: "Provider name",
      quantity: 1,
      price: "FREE",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      note: "Lorem ipsum.",
      linkUrl: "#",
    } satisfies ItemDetailData,
  },
  {
    id: "2",
    variant: "requested",
    requestedBy: "Requested by: Anonymous",
    section: "SEC-A206",
    time: "5:00 P.M.",
    price: "$$$",
    detail: {
      title: "Requested item",
      quantity: 2,
      price: "$$$",
      description:
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      note: "Contact for availability.",
    } satisfies ItemDetailData,
  },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getPriceRank(price: string): number {
  const p = price.toUpperCase();
  if (p === "FREE") return 0;
  if (p === "$") return 1;
  if (p === "$$") return 2;
  if (p === "$$$") return 3;
  return 4;
}

export default function Home() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ListItem[]>(INITIAL_ITEMS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"offer" | "request">("request");
  const [itemKind, setItemKind] = useState<"item" | "service">("item");
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    postedBy: "",
    count: 1,
    preferredTime: "",
    preferredVenue: "",
    monetaryIncentive: "",
    notesForRenter: "",
  });

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
      postedBy: "",
      count: 1,
      preferredTime: "",
      preferredVenue: "",
      monetaryIncentive: "",
      notesForRenter: "",
    });
    setCreateType("request");
    setItemKind("item");
  };

  const handlePost = () => {
    const title =
      form.itemName.trim() ||
      (createType === "offer" ? "New offer" : "New request");
    const prefix = itemKind === "service" ? "[Service] " : "";
    const fullTitle = prefix + title;
    const quantity = Math.max(1, form.count);
    const price =
      form.monetaryIncentive.trim() ||
      (createType === "offer" ? "FREE" : "$$$");

    const time = form.preferredTime.trim() || "—";
    const section = form.preferredVenue.trim() || "—";

    const detail: ItemDetailData = {
      title: fullTitle,
      quantity,
      price,
      description: form.description.trim() || "No description.",
      note: form.notesForRenter.trim() || undefined,
    };

    const postedByName = form.postedBy.trim() || "You";
    if (createType === "offer") {
      detail.lentBy = postedByName;
    }

    const requestedByLabel =
      createType === "offer"
        ? `Offered by: ${postedByName}`
        : `Requested by: ${postedByName}`;

    const newItem: ListItem = {
      id: generateId(),
      variant: createType === "offer" ? "lent" : "requested",
      requestedBy: requestedByLabel,
      section,
      time,
      price,
      detail,
    };

    setItems((prev) => [newItem, ...prev]);
    setIsCreateOpen(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar onSearchClick={() => setSearchOpen((open) => !open)} />

      <div className="relative flex-1">
        {/* Main content below navbar */}
        <div className="flex flex-col h-full">
          {/* Category filter row */}
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
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />

          {/* Main content - item list */}
          <main className="flex-1 px-2 py-6 pb-28">
            <div className="flex flex-col gap-3 max-w-md mx-auto">
              {filteredItems.map((item) => (
                <ItemRequestCard
                  key={item.id}
                  variant={item.variant}
                  requestedBy={item.requestedBy}
                  section={item.section}
                  time={item.time}
                  price={item.price}
                  detail={item.detail}
                  onClick={() => {
                    const kind = item.variant === "lent" ? "offer" : "request";
                    const title = item.detail.title ?? "ITEM";
                    router.push(
                      `/chat?itemId=${encodeURIComponent(item.id)}&kind=${encodeURIComponent(
                        kind,
                      )}&title=${encodeURIComponent(title)}`,
                    );
                  }}
                />
              ))}
            </div>
          </main>
        </div>

        {/* Create request/offer modal */}
        {isCreateOpen && (
          <div className="absolute inset-x-0 top-0 bottom-24 bg-white z-20 rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.16)] overflow-hidden flex flex-col">
            <div className="max-w-md mx-auto flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide">
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
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    Type
                  </div>
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

                {/* Posted by */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    {createType === "offer" ? "Offered by" : "Requested by"}
                  </div>
                  <Input
                    value={form.postedBy}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, postedBy: e.target.value }))
                    }
                    placeholder="Your name (defaults to You)"
                    className="flex-1 rounded-xl bg-gray-100 border-0"
                  />
                </div>

                {/* Item name */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    Item
                  </div>
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
                    rows={2}
                    className="flex-1 rounded-xl bg-gray-100 border-0 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Add more details about your item or request..."
                  />
                </div>

                {/* Image */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    Image
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-gray-200 px-4 py-2 text-sm text-gray-700"
                  >
                    Add Image
                  </button>
                </div>

                {/* Count */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    Count
                  </div>
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
                    Preferred Time and Venue for Claiming
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <Input
                      value={form.preferredTime}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          preferredTime: e.target.value,
                        }))
                      }
                      placeholder="e.g. Today, 5 PM"
                      className="w-full rounded-xl bg-gray-100 border-0"
                    />
                    <Input
                      value={form.preferredVenue}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          preferredVenue: e.target.value,
                        }))
                      }
                      placeholder="e.g. SEC-A206"
                      className="w-full rounded-xl bg-gray-100 border-0"
                    />
                  </div>
                </div>

                {/* Monetary Incentive */}
                <div className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm text-gray-600">
                    Monetary Incentive
                  </div>
                  <Input
                    value={form.monetaryIncentive}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        monetaryIncentive: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                    className="flex-1 rounded-xl bg-gray-100 border-0"
                  />
                </div>

                {/* Notes for renter */}
                <div className="flex items-start gap-3">
                  <div className="w-28 shrink-0 pt-2 text-sm text-gray-600">
                    Notes for Renter
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
                    className="w-full rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white font-bold uppercase"
                  >
                    POST!
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating action button */}
        {!isCreateOpen && (
          <Button
            size="icon"
            className="fixed bottom-30 right-6 w-14 h-14 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white shadow-lg z-30 p-0 flex items-center justify-center"
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
