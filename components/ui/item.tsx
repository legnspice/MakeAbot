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
      className={`w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none h-56 flex flex-col ${
        onClick
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : "opacity-75"
      }`}
    >
      {/* Image area — always present for consistent layout */}
      <div className="relative w-full h-28 shrink-0">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="relative flex-1 min-h-0 p-3 pt-2 flex flex-col overflow-hidden">
        {typeBadge && (
          <span className="inline-block mb-1 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded self-start shrink-0">
            {typeBadge}
          </span>
        )}
        <h3 className="text-base font-bold text-gray-900 truncate shrink-0">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-sm text-gray-600 truncate shrink-0">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block text-sm text-gray-500 truncate">
            {detail.description}
          </p>
        )}
        <div className="mt-auto flex justify-between items-end shrink-0">
          {(hasLocation || hasDate) && (
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
              {hasLocation && <span>{section}</span>}
              {hasDate && <span>{time}</span>}
            </div>
          )}
          <span className="text-[#3761B0] font-semibold ml-auto">{price}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
