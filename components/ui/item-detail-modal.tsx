"use client";

import { useState } from "react";
import { ChevronLeft, ChatDotsFill, X, Clock } from "react-bootstrap-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ItemDetailData {
  imageUrl?: string;
  title: string;
  lentBy?: string;
  requestedBy?: string;
  location?: string;
  quantity?: number;
  price: string;
  description?: string;
  note?: string;
  urgency?: string;
  incentive?: string;
  posterId?: string;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!item) return null;

  const isOffer = !!item.lentBy;
  const priceAccent = isOffer ? "text-[#DEA440]" : "text-[#3761B0]";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed left-0 right-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200",
          "top-18 bottom-22 md:inset-0",
          className,
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
              <ChevronLeft size={20} />
            </Button>
          </div>

          {/* Image */}
          <div className="shrink-0 w-full h-40 bg-gray-100 overflow-hidden flex items-center justify-center">
            {item.imageUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="w-full h-full cursor-zoom-in"
                aria-label="View image full screen"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </button>
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
                <span
                  className={`font-semibold text-sm px-2 py-0.5 rounded ${
                    item.price === "FREE"
                      ? "bg-emerald-100 text-emerald-700"
                      : priceAccent
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
              <p className="text-sm text-gray-600">
                Requested by {item.requestedBy}
              </p>
            )}
            {item.location && (
              <p className="text-sm text-gray-600 mb-1">📍 {item.location}</p>
            )}
            {item.urgency && (
              <p className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                <Clock size={14} className="shrink-0" />
                Urgency: {item.urgency}
              </p>
            )}
            {item.note && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Note:</span> {item.note}
              </p>
            )}
            {item.description && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap overflow-y-auto max-h-24">
                {item.description}
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
                <ChatDotsFill size={16} />
                Chat
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 max-w-60 h-11 rounded-xl bg-[#DEA440] hover:bg-[#C48A2A] text-black font-semibold uppercase tracking-wide text-sm"
                onClick={() => onInquire?.(item)}
              >
                Inquire
              </Button>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && item.imageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image full screen"
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            aria-label="Close image"
          >
            <X size={24} />
          </button>
          <img
            src={item.imageUrl}
            alt={item.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
