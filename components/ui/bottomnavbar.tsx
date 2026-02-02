'use client';

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#4A6FA5] shadow-lg">
      <div className="flex justify-around items-center py-3">
        <button className="flex flex-col items-center gap-2 px-4">
          <div className="w-16 h-16 bg-gray-300 rounded-full" />
          <span className="text-white text-sm font-medium">Home</span>
        </button>
        
        <button className="flex flex-col items-center gap-2 px-4">
          <div className="w-16 h-16 bg-gray-300 rounded-full" />
          <span className="text-white text-sm font-medium">Requests</span>
        </button>
        
        <button className="flex flex-col items-center gap-2 px-4">
          <div className="w-16 h-16 bg-gray-300 rounded-full" />
          <span className="text-white text-sm font-medium">Offers</span>
        </button>
        
        <button className="flex flex-col items-center gap-2 px-4">
          <div className="w-16 h-16 bg-gray-300 rounded-full" />
          <span className="text-white text-sm font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}