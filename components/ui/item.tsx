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

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      {typeBadge && (
        <span className="inline-block mb-2 text-xs font-bold uppercase tracking-wider text-[#3761B0] bg-blue-50 px-2 py-0.5 rounded">
          {typeBadge}
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-sm text-gray-600">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {detail?.description && (
          <p className="hidden md:block text-sm text-gray-500 line-clamp-2">
            {detail.description}
          </p>
        )}
        {(hasLocation || hasDate) && (
          <div className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-0">
            {hasLocation && <span>{section}</span>}
            {hasDate && <span>{time}</span>}
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <span className="text-[#3761B0] font-semibold">{price}</span>
      </div>
    </button>
  );
}
