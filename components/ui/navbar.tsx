'use client';
import Link from 'next/link';
import { Search, User } from 'lucide-react';

type NavbarProps = {
  onSearchClick?: () => void;
};

export default function Navbar({ onSearchClick }: NavbarProps) {
  return (
    <nav className="flex justify-between items-center px-5 py-3 bg-white">
      <div className="text-4xl sm:text-5xl font-bold tracking-tight">
        MakeAbot
      </div>

      <div className="flex gap-5 items-center">
        <button
          type="button"
          className="w-12 h-12 bg-[#E5A550] rounded-full cursor-pointer hover:bg-[#D89440] transition-colors flex items-center justify-center"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="w-5 h-5 text-white" />
        </button>
        <Link
          href="/profile"
          className="w-12 h-12 bg-[#E5A550] rounded-full cursor-pointer hover:bg-[#D89440] transition-colors flex items-center justify-center"
          aria-label="Profile"
        >
          <User className="w-5 h-5 text-white" />
        </Link>
      </div>
    </nav>
  );
}