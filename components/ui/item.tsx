import Image from "next/image";
import type { ItemDetailData } from "@/components/ui/item-detail-modal";

export interface ItemRequestCardProps {
  imageUrl?: string;
  requestedBy?: string;
  section?: string;
  time?: string;
  price?: string;
  variant?: "lent" | "requested";
  typeBadge?: string;
  detail?: ItemDetailData;
  onClick?: () => void;
}

export default function ItemRequestCard({
  requestedBy = "Requested by:",
  section,
  time,
  price = "$$$",
  variant = "requested",
  typeBadge,
  detail,
  onClick,
}: ItemRequestCardProps) {
  const hasLocation = section && section !== "—";
  const hasDate = time && time !== "—";
  const imageUrl = detail?.imageUrl;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={`w-full h-36 text-left bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none flex flex-row ${
        onClick
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : "opacity-75"
      }`}
    >
      {/* Image area */}
      <div className="relative w-32 shrink-0 bg-gray-100 self-stretch">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-400">No image</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 flex flex-col">
        <div className="flex items-start gap-2">
          <h3 className="text-base font-bold text-gray-900 truncate">
            {detail?.title ?? "Item"}
          </h3>
          {typeBadge && (
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded">
              {typeBadge}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 truncate">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2 whitespace-pre-wrap leading-snug">
            {detail.description}
          </p>
        )}
        <div className="mt-auto pt-1 flex justify-between items-end">
          {(hasLocation || hasDate) && (
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
              {hasLocation && <span>{section}</span>}
              {hasDate && <span>{time}</span>}
            </div>
          )}
          <span className="text-[#3761B0] font-semibold ml-auto">{price}</span>
        </div>
      </div>
    </div>
  );
}
