'use client';

import { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ItemRequestCard from '@/components/ui/item';
import { Plus } from 'lucide-react';

const FILTERS = ['Items', 'Rental', 'Services'] as const;

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('Items');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar onSearchClick={() => setSearchOpen((open) => !open)} />

      {/* Category filter row */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2 items-center min-w-0">
          {FILTERS.map((label) => (
            <Button
              key={label}
              variant="outline"
              size="sm"
              className={`rounded-full shrink-0 ${
                activeFilter === label
                  ? 'bg-[#4A6FA5] text-white border-[#4A6FA5] hover:bg-[#3d5d8a] hover:text-white'
                  : 'bg-blue-50/80 text-[#4A6FA5] border-blue-200 hover:bg-blue-100 hover:text-[#4A6FA5]'
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
      <main className="flex-1 px-4 py-6 pb-28">
        <div className="flex flex-col gap-6 max-w-md mx-auto">
          <ItemRequestCard
            variant="lent"
            requestedBy="Lent by:"
            price="$$$"
          />
          <ItemRequestCard
            requestedBy="Requested by:"
            section="SEC-A206"
            time="5:00 P.M."
            price="$$$"
          />
        </div>
      </main>

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
