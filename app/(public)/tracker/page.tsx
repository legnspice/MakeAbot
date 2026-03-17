'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import FilterBar, { type SortOption } from '@/components/ui/filter-bar';
import { useAuth } from '@/contexts/auth-context';
import { getPosts, getPostBids } from '@/lib/actions/posts';
import { getRequests, getRequestBids } from '@/lib/actions/requests';
import { getUsers } from '@/lib/actions/users';

function getPriceRank(price: string): number {
  const p = price.toUpperCase();
  if (p === 'FREE') return 0;
  if (p.startsWith('₱')) return parseInt(p.slice(1), 10) || 1;
  if (p === '$') return 1;
  if (p === '$$') return 2;
  if (p === '$$$') return 3;
  return 4;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || value === 0) return 'FREE';
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

type TrackerCard = { type: 'offer'; data: TrackerOffer } | { type: 'request'; data: TrackerRequest };

export default function TrackerPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const currentUser = userData.publicUser;

  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [customFilters, setCustomFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [offers, setOffers] = useState<TrackerOffer[]>([]);
  const [requests, setRequests] = useState<TrackerRequest[]>([]);

  const loadData = useCallback(async () => {
    const [postsResult, requestsResult] = await Promise.all([
      getPosts({ user_id: currentUser.id }),
      getRequests({ user_id: currentUser.id }),
    ]);

    // Load offers with bidders
    const offerList: TrackerOffer[] = [];
    if (postsResult.data) {
      for (const post of postsResult.data) {
        const bidsResult = await getPostBids({ post_id: post.id });
        const bids = bidsResult.data ?? [];

        const requesters: { id: string; name: string; bidId: string }[] = [];
        for (const bid of bids) {
          const userResult = await getUsers({ id: bid.bidder_id });
          const name = userResult.data?.[0]?.name ?? 'User';
          requesters.push({ id: bid.bidder_id, name, bidId: bid.id });
        }

        offerList.push({
          id: post.id,
          itemName: post.title,
          requesterCount: bids.length,
          requesters,
        });
      }
    }
    setOffers(offerList);

    // Load requests with bidders
    const requestList: TrackerRequest[] = [];
    if (requestsResult.data) {
      for (const req of requestsResult.data) {
        const bidsResult = await getRequestBids({ request_id: req.id });
        const bids = bidsResult.data ?? [];

        const bidders: { id: string; name: string; bidId: string }[] = [];
        for (const bid of bids) {
          const userResult = await getUsers({ id: bid.bidder_id });
          const name = userResult.data?.[0]?.name ?? 'User';
          bidders.push({ id: bid.bidder_id, name, bidId: bid.id });
        }

        requestList.push({
          id: req.id,
          itemName: req.title,
          status: req.status,
          price: formatPrice(req.fee),
          bidders,
          notificationCount: bids.length > 0 ? bids.length : undefined,
        });
      }
    }
    setRequests(requestList);
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allFilterLabels = ['All', 'Offers', 'Requests', ...customFilters];

  const filterOffers = (list: TrackerOffer[]) =>
    activeFilter === 'All' || activeFilter === 'Offers'
      ? list
      : activeFilter === 'Requests'
        ? []
        : list.filter((o) => o.itemName.toLowerCase().includes(activeFilter.toLowerCase()));

  const filterRequests = (list: TrackerRequest[]) =>
    activeFilter === 'All' || activeFilter === 'Requests'
      ? list
      : activeFilter === 'Offers'
        ? []
        : list.filter((r) => r.itemName.toLowerCase().includes(activeFilter.toLowerCase()));

  const cards: TrackerCard[] = [
    ...filterOffers(offers).map((data) => ({ type: 'offer' as const, data })),
    ...filterRequests(requests).map((data) => ({ type: 'request' as const, data })),
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

  const goToChat = (bidId: string, kind: 'offer' | 'request', title: string, otherId: string) => {
    router.push(
      `/chat?bidId=${encodeURIComponent(bidId)}&kind=${encodeURIComponent(kind)}&title=${encodeURIComponent(title)}&otherId=${encodeURIComponent(otherId)}`
    );
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
                  onRequesterClick={(bidId, otherId) =>
                    goToChat(bidId, 'offer', card.data.itemName, otherId)
                  }
                />
              ) : (
                <RequestCard
                  key={`request-${card.data.id}`}
                  request={card.data}
                  onBidderClick={(bidId, otherId) =>
                    goToChat(bidId, 'request', card.data.itemName, otherId)
                  }
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
          {offer.requesterCount} {offer.requesterCount === 1 ? 'requester' : 'requesters'}
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
      <h3 className="text-lg font-bold text-gray-900 pr-8">{request.itemName}</h3>
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
