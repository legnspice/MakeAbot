'use client';

import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { SquarePen } from 'lucide-react';

const SAMPLE_OFFERS = [
  { title: 'ITEM', shortDesc: 'short desc', price: '$$$' },
  { title: 'ITEM', shortDesc: 'short desc', price: '$$$' },
  { title: 'ITEM', shortDesc: 'short desc', price: '$$$' },
];

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1 px-4 pt-6 pb-28 max-w-md mx-auto w-full">
        {/* Profile header */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-start">
            {/* Profile picture */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium uppercase">
                PROF_PIC
              </div>
              <button
                type="button"
                className="absolute -top-1 -right-1 w-6 h-6 bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors"
                aria-label="Edit profile picture"
              >
                <SquarePen className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Name, pronouns, action buttons */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Juan Dela Cruz</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm text-gray-700">he/him</span>
                <button
                  type="button"
                  className="w-5 h-5 bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors"
                  aria-label="Edit pronouns"
                >
                  <SquarePen className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="h-9 flex-1 rounded-lg bg-gray-200" />
                <div className="h-9 flex-1 rounded-lg bg-gray-200" />
              </div>
            </div>
          </div>

          {/* Description / bio */}
          <div className="relative">
            <blockquote className="text-gray-700 text-sm leading-relaxed pr-8">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </blockquote>
            <button
              type="button"
              className="absolute top-0 right-0 w-5 h-5 bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors"
              aria-label="Edit description"
            >
              <SquarePen className="w-3 h-3" />
            </button>
          </div>

          {/* Transactions */}
          <Button
            type="button"
            className="w-full rounded-xl bg-[#3761B0] hover:bg-[#2d5199] text-white font-medium py-6"
          >
            100 completed transactions
          </Button>
        </div>

        {/* Current offers */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Current Offers</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {SAMPLE_OFFERS.map((offer, i) => (
              <div
                key={i}
                className="shrink-0 w-40 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="font-bold text-gray-800 uppercase text-sm mb-1">
                  {offer.title}
                </p>
                <p className="text-sm text-gray-500 mb-2">{offer.shortDesc}</p>
                <p className="font-bold text-gray-900">{offer.price}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
