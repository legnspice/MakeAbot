"use client";

import { ChevronLeft, BoxArrowUpRight, ChatDotsFill, X } from "react-bootstrap-icons";
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
    if (item.linkUrl) window.open(item.linkUrl, "_blank");
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
          "fixed left-0 right-0 z-50 flex items-center justify-center px-4 animate-in fade-in duration-200",
          "top-18 bottom-22 md:inset-0",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
      >
        <div className="h-full max-h-[28rem] md:max-h-[26rem] w-full max-w-sm md:max-w-3xl flex flex-col md:flex-row rounded-2xl bg-white shadow-xl overflow-hidden">
          {/* Back button (mobile only) */}
          <div className="shrink-0 p-3 md:hidden">
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
          <div className="shrink-0 w-full h-40 md:h-auto md:w-1/2 bg-gray-100 overflow-hidden flex items-center justify-center">
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

          {/* Details column */}
          <div className="flex-1 min-h-0 flex flex-col md:w-1/2 md:relative">
            {/* Close button (desktop only) */}
            <button
              type="button"
              className="hidden md:flex absolute top-3 right-3 w-8 h-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={22} />
            </button>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3 md:pt-6 md:pr-12">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h1
                  id="item-detail-title"
                  className="text-lg font-bold text-gray-900 leading-tight"
                >
                  {item.title}
                </h1>
                <div className="flex items-center gap-2 shrink-0 md:hidden">
                  {item.quantity != null && (
                    <span className="text-[#3761B0] text-sm font-medium">
                      {item.quantity}x
                    </span>
                  )}
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
                <p className="text-sm text-gray-600">
                  Requested by {item.requestedBy}
                </p>
              )}
              {item.location && (
                <p className="text-sm text-gray-600 mb-1">📍 {item.location}</p>
              )}
              {item.note && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Note:</span> {item.note}
                </p>
              )}
              {item.description && (
                <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">
                  {item.description}
                </p>
              )}

              {/* Price (desktop) */}
              <div className="hidden md:flex items-center gap-2 mt-4">
                {item.quantity != null && (
                  <span className="text-[#3761B0] text-sm font-medium">
                    {item.quantity}x
                  </span>
                )}
                <span
                  className={`font-semibold text-base ${
                    item.price === "FREE"
                      ? "bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded"
                      : "text-[#3761B0]"
                  }`}
                >
                  {item.price}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 pt-3 px-3 md:px-6 pb-5 md:pb-6 flex items-center justify-center md:justify-start gap-3 border-t border-gray-100 md:border-t-0">
              {isOwner ? (
                <Button
                  type="button"
                  className="flex-1 max-w-60 md:max-w-none h-11 rounded-full bg-[#3761B0] hover:bg-[#2a4d8a] text-white font-semibold uppercase tracking-wide text-sm flex items-center justify-center gap-2"
                  onClick={onChatClick}
                >
                  <ChatDotsFill size={16} />
                  Chat
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1 max-w-60 md:max-w-none h-11 rounded-full bg-[#DEA440] hover:bg-[#C48A2A] text-black font-semibold uppercase tracking-wide text-sm"
                  onClick={() => onInquire?.(item)}
                >
                  Inquire
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full w-11 h-11 border-0 bg-[#DEA440] text-white hover:bg-[#C48A2A] disabled:opacity-50 disabled:pointer-events-none"
                onClick={handleLinkClick}
                disabled={!item.linkUrl}
                aria-label={item.linkUrl ? "Open link" : "No link available"}
              >
                <BoxArrowUpRight size={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
