'use client';

import { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ItemRequestCard from '@/components/ui/item';
import ItemDetailModal, { type ItemDetailData } from '@/components/ui/item-detail-modal';
import { Plus } from 'lucide-react';

const FILTERS = ['Items', 'Rental', 'Services'] as const;

const SAMPLE_ITEMS = [
  {
    variant: 'lent' as const,
    requestedBy: 'Lent by:',
    price: 'FREE',
    detail: {
      title: 'Lorem Ipsum item',
      lentBy: 'Provider name',
      quantity: 1,
      price: 'FREE',
      description:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      note: 'Lorem ipsum.',
      linkUrl: '#',
    } satisfies ItemDetailData,
  },
  {
    variant: 'requested' as const,
    requestedBy: 'Requested by:',
    section: 'SEC-A206',
    time: '5:00 P.M.',
    price: '$$$',
    detail: {
      title: 'Requested item',
      quantity: 2,
      price: '$$$',
      description:
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      note: 'Contact for availability.',
    } satisfies ItemDetailData,
  },
];

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('Items');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDetailData | null>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar onSearchClick={() => setSearchOpen((open) => !open)} />

      {/* Category filter row */}
      <div className="px-4 pt-2 pb-2 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2 items-center min-w-0">
          {FILTERS.map((label) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className={`rounded-full shrink-0 ${
                activeFilter === label
                  ? 'bg-[#3761B0] text-white border-[#3761B0] hover:bg-[#3761B0] hover:text-white'
                  : 'bg-blue-50/80 text-[#3761B0] border-blue-200 hover:bg-blue-100 hover:text-[#3761B0]'
              }`}
              onClick={() => setActiveFilter(label)}
            >
              {label}
            </Button>
          ))}
        </div>
        {searchOpen && (
          <div className="mt-3">
            <Input
              type="search"
              placeholder="Search items..."
              className="rounded-full border-gray-200 bg-gray-50 text-sm"
              aria-label="Search items"
            />
          </div>
        )}
      </div>

      {/* Main content - item list */}
      <main className="flex-1 px-2 py-6 pb-28">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {SAMPLE_ITEMS.map((item, index) => (
            <ItemRequestCard
              key={index}
              variant={item.variant}
              requestedBy={item.requestedBy}
              section={item.section}
              time={item.time}
              price={item.price}
              detail={item.detail}
              onClick={() => item.detail && setSelectedItem(item.detail)}
            />
          ))}
        </div>
      </main>

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onInquire={(item) => {
            // Optional: handle inquire action
            console.log('Inquire', item);
          }}
        />
      )}

      {/* Floating action button */}
      <Button
        size="icon"
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white shadow-lg z-10"
        aria-label="Add item"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <BottomNav />
    </div>
  );
}
