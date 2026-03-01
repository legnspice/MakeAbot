'use client';

import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { Button } from '@/components/ui/button';
import { SquarePen, Star } from 'lucide-react';

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
          <div className="relative flex flex-col items-start gap-3">
            <button
              type="button"
              className="absolute top-0 right-0 w-8 h-8 bg-[#E5A550] rounded flex items-center justify-center text-white hover:bg-[#D89440] transition-colors"
              aria-label="Edit profile"
            >
              <SquarePen className="w-4 h-4" />
            </button>

            {/* Profile picture on top, aligned left */}
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium uppercase">
              PROF_PIC
            </div>

            {/* Row: name/pronouns group + rating */}
            <div className="flex items-center justify-between gap-4 w-full pr-2">
              <div className="flex flex-col items-start">
                <h1 className="text-2xl font-bold text-gray-900">Juan Dela Cruz</h1>
                <span className="text-sm text-gray-700 mt-1">he/him</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 shrink-0 ml-auto">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-5 h-5 ${
                        n <= 4 ? 'fill-[#E5A550] text-[#E5A550]' : 'fill-gray-200 text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 font-medium">4 out of 5</span>
              </div>
            </div>
          </div>

          {/* Description / bio */}
          <blockquote className="text-gray-700 text-sm leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </blockquote>

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
