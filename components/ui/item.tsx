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
  onEdit?: () => void;
  onDelete?: () => void;
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
  onEdit,
  onDelete,
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
      className={`w-full h-28 text-left bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none flex flex-row ${
        onClick || onEdit || onDelete
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : "opacity-75"
      }`}
    >
      {/* Image area — square */}
      <div className="relative h-full aspect-square shrink-0 bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-gray-400">No image</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative flex-1 min-w-0 p-2.5 flex flex-col">
        {typeBadge && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-1.5 py-0.5 rounded">
            {typeBadge}
          </span>
        )}
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 pr-16">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-xs text-gray-600 truncate">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block mt-0.5 text-[11px] text-gray-400 line-clamp-1 whitespace-pre-wrap leading-snug">
            {detail.description}
          </p>
        )}
        <div className="mt-auto flex justify-between items-end">
          {(onEdit || onDelete) ? (
            <div className="flex gap-1.5">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="px-2.5 py-0.5 text-xs font-medium border border-gray-300 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="px-2.5 py-0.5 text-xs font-medium border border-red-300 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          ) : (
            (hasLocation || hasDate) && (
              <div className="text-xs text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
                {hasLocation && <span>{section}</span>}
                {hasDate && <span>{time}</span>}
              </div>
            )
          )}
          <span className="text-[#3761B0] font-semibold text-sm ml-auto">{price}</span>
        </div>
      </div>
    </div>
  );
}
