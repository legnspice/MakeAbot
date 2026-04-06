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
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none h-52 flex flex-col ${
        onClick
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : "opacity-75"
      }`}
    >
      {imageUrl && (
        <div className="w-full h-24 bg-gray-100 shrink-0 overflow-hidden">
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            width={400}
            height={96}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        {typeBadge && (
          <span className="inline-block mb-1 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded self-start">
            {typeBadge}
          </span>
        )}
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-1">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block text-sm text-gray-500 line-clamp-1 whitespace-pre-wrap">
            {detail.description}
          </p>
        )}
        <div className="mt-auto flex justify-between items-end">
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
