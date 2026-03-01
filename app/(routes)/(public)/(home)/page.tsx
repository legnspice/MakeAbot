'use client';

import { useState } from 'react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ItemRequestCard from '@/components/ui/item';
import ItemDetailModal, { type ItemDetailData } from '@/components/ui/item-detail-modal';
import { Plus, ChevronLeft } from 'lucide-react';

const FILTERS = ['Items', 'Rental', 'Services'] as const;

type ListItem = {
  id: string;
  variant: 'lent' | 'requested';
  requestedBy: string;
  section?: string;
  time?: string;
  price: string;
  detail: ItemDetailData;
};

const INITIAL_ITEMS: ListItem[] = [
  {
    id: '1',
    variant: 'lent',
    requestedBy: 'Offered by: Provider name',
    section: 'SEC-A206',
    time: '5:00 P.M.',
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
    id: '2',
    variant: 'requested',
    requestedBy: 'Requested by: Anonymous',
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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('Items');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDetailData | null>(null);
  const [items, setItems] = useState<ListItem[]>(INITIAL_ITEMS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'offer' | 'request'>('request');
  const [itemKind, setItemKind] = useState<'item' | 'service'>('item');
  const [form, setForm] = useState({
    itemName: '',
    description: '',
    postedBy: '',
    count: 1,
    preferredTimeVenue: '',
    monetaryIncentive: '',
    notesForRenter: '',
  });

  const resetForm = () => {
    setForm({
      itemName: '',
      description: '',
      postedBy: '',
      count: 1,
      preferredTimeVenue: '',
      monetaryIncentive: '',
      notesForRenter: '',
    });
    setCreateType('request');
    setItemKind('item');
  };

  const handlePost = () => {
    const title = form.itemName.trim() || (createType === 'offer' ? 'New offer' : 'New request');
    const prefix = itemKind === 'service' ? '[Service] ' : '';
    const fullTitle = prefix + title;
    const quantity = Math.max(1, form.count);
    const price = form.monetaryIncentive.trim() || (createType === 'offer' ? 'FREE' : '$$$');

    const [section, time] = (() => {
      const s = form.preferredTimeVenue.trim();
      if (!s) return ['—', '—'];
      const atIdx = s.toLowerCase().indexOf(' at ');
      if (atIdx >= 0) return [s.slice(atIdx + 4).trim(), s.slice(0, atIdx).trim()];
      return ['—', s];
    })();

    const detail: ItemDetailData = {
      title: fullTitle,
      quantity,
      price,
      description: form.description.trim() || 'No description.',
      note: form.notesForRenter.trim() || undefined,
    };

    const postedByName = form.postedBy.trim() || 'You';
    if (createType === 'offer') {
      detail.lentBy = postedByName;
    }

    const requestedByLabel =
      createType === 'offer'
        ? `Offered by: ${postedByName}`
        : `Requested by: ${postedByName}`;

    const newItem: ListItem = {
      id: generateId(),
      variant: createType === 'offer' ? 'lent' : 'requested',
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
              {items.map((item) => (
                <ItemRequestCard
                  key={item.id}
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
        </div>

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

        {/* Create request/offer modal */}
        {isCreateOpen && (
          <div className="absolute inset-x-0 top-0 bottom-24 bg-white z-20 rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.16)] overflow-y-auto">
            <div className="max-w-md mx-auto h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="p-2 rounded-full hover:bg-gray-100"
                  aria-label="Close create item form"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 text-center -ml-8">
                  <p className="text-sm text-gray-500">Create an</p>
                  <div className="mt-2 inline-flex rounded-full bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setCreateType('offer')}
                      className={`px-4 py-1.5 text-sm rounded-full ${
                        createType === 'offer'
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'text-gray-600'
                      }`}
                    >
                      Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateType('request')}
                      className={`px-4 py-1.5 text-sm rounded-full ${
                        createType === 'request'
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'text-gray-600'
                      }`}
                    >
                      Request
                    </button>
                  </div>
                </div>

                <div className="w-9" />
              </div>

              {/* Form */}
              <div className="px-5 pt-2 pb-6 space-y-4 overflow-y-auto">
                {/* Type: Item / Service */}
                <div className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">Type</div>
                  <div className="inline-flex rounded-full bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setItemKind('item')}
                      className={`px-3 py-1.5 text-sm rounded-full ${
                        itemKind === 'item'
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'text-gray-600'
                      }`}
                    >
                      Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemKind('service')}
                      className={`px-3 py-1.5 text-sm rounded-full ${
                        itemKind === 'service'
                          ? 'bg-white text-black font-semibold shadow-sm'
                          : 'text-gray-600'
                      }`}
                    >
                      Service
                    </button>
                  </div>
                </div>

                {/* Posted by */}
                <div className="flex items-start gap-4">
                  <div className="w-32 mt-2 text-sm text-gray-600">
                    {createType === 'offer' ? 'Offered by' : 'Requested by'}
                  </div>
                  <Input
                    value={form.postedBy}
                    onChange={(e) => setForm((f) => ({ ...f, postedBy: e.target.value }))}
                    placeholder="Your name (defaults to You)"
                    className="flex-1 rounded-2xl bg-blue-50/80 border-blue-100"
                  />
                </div>

                {/* Item name */}
                <div className="flex items-start gap-4">
                  <div className="w-32 mt-2 text-sm text-gray-600">Item</div>
                  <Input
                    value={form.itemName}
                    onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                    placeholder="What do you need?"
                    className="flex-1 rounded-2xl bg-blue-50/80 border-blue-100"
                  />
                </div>

                {/* Description */}
                <div className="flex items-start gap-4">
                  <div className="w-32 mt-2 text-sm text-gray-600">Description</div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="flex-1 rounded-2xl bg-blue-50/80 border border-blue-100 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#3761B0]"
                    placeholder="Add more details about your item or request..."
                  />
                </div>

                {/* Image */}
                <div className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">Image</div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-gray-200 px-4 py-2 text-sm text-gray-700"
                  >
                    Add Image
                  </button>
                </div>

                {/* Count */}
                <div className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">Count</div>
                  <Input
                    type="number"
                    min={1}
                    value={form.count}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, count: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                    }
                    className="w-24 rounded-2xl bg-blue-50/80 border-blue-100"
                  />
                </div>

                {/* Preferred Time and Venue */}
                <div className="flex items-start gap-4">
                  <div className="w-32 mt-2 text-sm text-gray-600">
                    Preferred Time and Venue for Claiming
                  </div>
                  <Input
                    value={form.preferredTimeVenue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, preferredTimeVenue: e.target.value }))
                    }
                    placeholder="e.g. Today, 5 PM at SEC-A206"
                    className="flex-1 rounded-2xl bg-blue-50/80 border-blue-100"
                  />
                </div>

                {/* Monetary Incentive */}
                <div className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">Monetary Incentive</div>
                  <Input
                    value={form.monetaryIncentive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, monetaryIncentive: e.target.value }))
                    }
                    placeholder="Optional"
                    className="flex-1 rounded-2xl bg-blue-50/80 border-blue-100"
                  />
                </div>

                {/* Notes for renter */}
                <div className="flex items-start gap-4">
                  <div className="w-32 mt-2 text-sm text-gray-600">Notes for Renter</div>
                  <textarea
                    value={form.notesForRenter}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notesForRenter: e.target.value }))
                    }
                    rows={3}
                    className="flex-1 rounded-2xl bg-blue-50/80 border border-blue-100 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#3761B0]"
                    placeholder="Anything else they should know?"
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="button"
                    onClick={handlePost}
                    className="w-full rounded-full bg-[#E5A550] hover:bg-[#D89440] text-black font-semibold"
                  >
                    POST!
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating action button */}
        <Button
          size="icon"
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-[#E5A550] hover:bg-[#D89440] text-white shadow-lg z-30"
          aria-label="Add item"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
