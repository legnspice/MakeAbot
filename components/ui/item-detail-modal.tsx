'use client';

import { ChevronLeft, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ItemDetailData {
  imageUrl?: string;
  title: string;
  lentBy?: string;
  requestedBy?: string;
  location?: string;
  quantity?: number;
  price: string;
  description: string;
  note?: string;
  linkUrl?: string;
}

interface ItemDetailModalProps {
  item: ItemDetailData | null;
  onClose: () => void;
  onInquire?: (item: ItemDetailData) => void;
  onChatClick?: () => void;
  isOwner?: boolean;
  className?: string;
}

export default function ItemDetailModal({
  item,
  onClose,
  onInquire,
  onChatClick,
  isOwner = false,
  className,
}: ItemDetailModalProps) {
  if (!item) return null;

  const handleLinkClick = () => {
    if (item.linkUrl) window.open(item.linkUrl, '_blank');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed left-0 right-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200',
          'top-18 bottom-22 md:inset-0',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
      >
        <div className="h-full max-h-[28rem] md:max-h-[32rem] w-full max-w-sm flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden">
          {/* Back button */}
          <div className="shrink-0 p-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full border-gray-200 bg-white shadow-sm hover:bg-gray-50"
              onClick={onClose}
              aria-label="Close"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>

          {/* Image */}
          <div className="shrink-0 w-full h-40 bg-gray-100 overflow-hidden flex items-center justify-center">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-300 text-xs uppercase tracking-widest font-medium">
                No image
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 px-4 py-3">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h1
                id="item-detail-title"
                className="text-lg font-bold text-gray-900 leading-tight"
              >
                {item.title}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                {item.quantity != null && <span className="text-[#3761B0] text-sm font-medium">{item.quantity}x</span>}
                <span
                  className={`font-semibold text-sm px-2 py-0.5 rounded ${
                    item.price === "FREE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "text-[#3761B0]"
                  }`}
                >
                  {item.price}
                </span>
              </div>
            </div>
            {item.lentBy && (
              <p className="text-sm text-gray-600">Lent by {item.lentBy}</p>
            )}
            {item.requestedBy && (
              <p className="text-sm text-gray-600">Requested by {item.requestedBy}</p>
            )}
            {item.location && (
              <p className="text-sm text-gray-600 mb-1">📍 {item.location}</p>
            )}
            {item.note && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Note:</span> {item.note}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 pt-3 px-3 pb-5 flex items-center justify-center gap-3 border-t border-gray-100">
            {isOwner ? (
              <Button
                type="button"
                className="flex-1 max-w-60 h-11 rounded-xl bg-[#3761B0] hover:bg-[#2a4d8a] text-white font-semibold uppercase tracking-wide text-sm flex items-center justify-center gap-2"
                onClick={onChatClick}
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 max-w-60 h-11 rounded-xl bg-[#CDA452] hover:bg-[#B8923F] text-white font-semibold uppercase tracking-wide text-sm"
                onClick={() => onInquire?.(item)}
              >
                Inquire
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full w-11 h-11 border-0 bg-[#3761B0] text-white hover:bg-[#2d5199] disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleLinkClick}
              disabled={!item.linkUrl}
              aria-label={item.linkUrl ? 'Open link' : 'No link available'}
            >
              <ExternalLink className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
