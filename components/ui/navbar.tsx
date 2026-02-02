'use client';
import { Search, Bell } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center px-10 py-5 border-b border-gray-200 bg-white">
      <div className="text-5xl font-bold tracking-tight">
        MakeAbot
      </div>
      
      <div className="flex gap-5 items-center">
        <button className="w-12 h-12 bg-[#E5A550] rounded-full cursor-pointer hover:bg-[#D89440] transition-colors flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </button>
        <button className="w-12 h-12 bg-[#E5A550] rounded-full cursor-pointer hover:bg-[#D89440] transition-colors flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </button>
      </div>
    </nav>
  );
}