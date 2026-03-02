'use client';

import Link from 'next/link';

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#4A6FA5] shadow-lg">
      <div className="flex justify-around items-stretch gap-1 py-3 px-2 min-h-[72px]">
        <Link
          href="/"
          className="flex flex-1 flex-col items-center justify-center gap-1.5 min-w-0 px-1 py-2"
        >
          <div className="w-12 h-12 shrink-0 bg-gray-300 rounded-full" />
          <span className="text-white text-xs sm:text-sm font-medium text-center leading-tight line-clamp-2 wrap-break-words">
            Home
          </span>
        </Link>

        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1.5 min-w-0 px-1 py-2"
        >
          <div className="w-12 h-12 shrink-0 bg-gray-300 rounded-full" />
          <span className="text-white text-xs sm:text-sm font-medium text-center leading-tight line-clamp-2 wrap-break-words">
            Tracker
          </span>
        </button>

        <Link
          href="/notifications"
          className="flex flex-1 flex-col items-center justify-center gap-1.5 min-w-0 px-1 py-2"
        >
          <div className="w-12 h-12 shrink-0 bg-gray-300 rounded-full" />
          <span className="text-white text-xs sm:text-sm font-medium text-center leading-tight line-clamp-2 wrap-break-words">
            Notifications
          </span>
        </Link>
      </div>
    </nav>
  );
}