'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import Navbar from '@/components/ui/navbar';
import BottomNav from '@/components/ui/bottomnavbar';
import { ChatRoom } from '@/components/chat-room';

export default function ChatPage() {
  const router = useRouter();
  const params = useSearchParams();

  const bidId = params.get('bidId') ?? '';
  const kind = params.get('kind') ?? 'offer'; // offer | request
  const title = params.get('title') ?? 'ITEM';
  const otherId = params.get('otherId') ?? '';

  if (!bidId || !otherId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-gray-500">
        <p>Invalid chat link.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-[#3761B0] underline text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 min-h-0 flex flex-col pb-28">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full border border-[#3761B0] text-[#3761B0] flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 leading-tight line-clamp-1">{title}</p>
            <p className="text-xs text-gray-500 leading-tight">
              {kind === 'offer' ? 'Offer' : 'Request'}
            </p>
          </div>

          <button
            type="button"
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
            aria-label="Menu"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </header>

        {/* Chat area */}
        <div className="flex-1 min-h-0">
          <ChatRoom
            other_user_id={otherId}
            post_bid_id={kind === 'offer' ? bidId : null}
            request_bid_id={kind === 'request' ? bidId : null}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
