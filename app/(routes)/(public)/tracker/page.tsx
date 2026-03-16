'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import FilterBar, { type SortOption } from '@/components/ui/filter-bar';

function getPriceRank(price: string): number {
  const p = price.toUpperCase();
  if (p === 'FREE') return 0;
  if (p === '$') return 1;
  if (p === '$$') return 2;
  if (p === '$$$') return 3;
  return 4;
}

type TrackerOffer = {
  id: string;
  itemName: string;
  requesterCount: number;
  requesters: { id: string; name: string }[];
  notificationCount?: number;
};

type TrackerRequest = {
  id: string;
  itemName: string;
  status: string;
  price: string;
  notificationCount?: number;
};

const SAMPLE_OFFERS: TrackerOffer[] = [
  {
    id: '1',
    itemName: 'ITEM',
    requesterCount: 3,
    requesters: [
      { id: 'a', name: 'User A' },
      { id: 'b', name: 'User B' },
      { id: 'c', name: 'User C' },
    ],
    notificationCount: 1,
  },
];

const SAMPLE_REQUESTS: TrackerRequest[] = [
  {
    id: '1',
    itemName: 'ITEM',
    status: 'Accepted Urgent Request',
    price: '$$$',
    notificationCount: 1,
  },
];

type TrackerCard = { type: 'offer'; data: TrackerOffer } | { type: 'request'; data: TrackerRequest };

export default function TrackerPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const allFilterLabels = ['All', 'Offers', 'Requests', ...customFilters];

  const filterOffers = (offers: TrackerOffer[]) =>
    activeFilter === 'All'
      ? offers
      : activeFilter === 'Offers'
        ? offers
        : activeFilter === 'Requests'
          ? []
          : offers.filter((o) =>
              o.itemName.toLowerCase().includes(activeFilter.toLowerCase())
            );

  const filterRequests = (requests: TrackerRequest[]) =>
    activeFilter === 'All'
      ? requests
      : activeFilter === 'Offers'
        ? []
        : activeFilter === 'Requests'
          ? requests
          : requests.filter((r) =>
              r.itemName.toLowerCase().includes(activeFilter.toLowerCase())
            );

  const filteredOffers = filterOffers(SAMPLE_OFFERS);
  const filteredRequests = filterRequests(SAMPLE_REQUESTS);

  const cards: TrackerCard[] = [
    ...filteredOffers.map((data) => ({ type: 'offer' as const, data })),
    ...filteredRequests.map((data) => ({ type: 'request' as const, data })),
  ];

  const sortedCards =
    sortBy === 'date'
      ? cards
      : [...cards].sort((a, b) => {
          const priceA = a.type === 'offer' ? 'FREE' : a.data.price;
          const priceB = b.type === 'offer' ? 'FREE' : b.data.price;
          return getPriceRank(priceA) - getPriceRank(priceB);
        });

  const handleAddFilter = () => {
    const name = newFilterName.trim();
    if (name && !customFilters.includes(name)) {
      setCustomFilters((prev) => [...prev, name]);
      setActiveFilter(name);
      setNewFilterName('');
      setAddFilterOpen(false);
    }
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
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortModalOpen={sortModalOpen}
        onSortModalOpenChange={setSortModalOpen}
      />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 pb-28">
        <section aria-label="Tracker">
          <div className="flex flex-col gap-3">
            {sortedCards.map((card) =>
              card.type === 'offer' ? (
                <OfferCard
                  key={`offer-${card.data.id}`}
                  offer={card.data}
                  onClick={() => {
                    router.push(
                      `/chat?itemId=${encodeURIComponent(card.data.id)}&kind=offer&title=${encodeURIComponent(
                        card.data.itemName
                      )}`
                    );
                  }}
                />
              ) : (
                <RequestCard
                  key={`request-${card.data.id}`}
                  request={card.data}
                  onClick={() => {
                    router.push(
                      `/chat?itemId=${encodeURIComponent(card.data.id)}&kind=request&title=${encodeURIComponent(
                        card.data.itemName
                      )}`
                    );
                  }}
                />
              )
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

function OfferCard({ offer, onClick }: { offer: TrackerOffer; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      {offer.notificationCount != null && offer.notificationCount > 0 && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
          {offer.notificationCount}
        </div>
      )}
      <h3 className="text-lg font-bold text-gray-900 pr-8">{offer.itemName}</h3>
      <p className="text-sm text-gray-600 mt-1">Offer</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">
          {offer.requesterCount} requesters
        </span>
        <div className="flex -space-x-2">
          {offer.requesters.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium"
              title={r.name}
            >
              {r.name.charAt(0)}
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

function RequestCard({ request, onClick }: { request: TrackerRequest; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      {request.notificationCount != null && request.notificationCount > 0 && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
          {request.notificationCount}
        </div>
      )}
      <h3 className="text-lg font-bold text-gray-900 pr-8">{request.itemName}</h3>
      <p className="text-sm text-gray-600 mt-1">{request.status}</p>
      <div className="mt-3 flex justify-end">
        <span className="text-[#3761B0] font-semibold">{request.price}</span>
      </div>
    </button>
  );
}

