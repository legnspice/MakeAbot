import Image from "next/image";
import { TagFill, QuestionCircleFill, Clock } from "react-bootstrap-icons";
import type { ItemDetailData } from "@/components/ui/item-detail-modal";

export interface ItemRequestCardProps {
  imageUrl?: string;
  requestedBy?: string;
  section?: string;
  time?: string;
  price?: string;
  variant?: "lent" | "requested";
  typeBadge?: string;
  urgency?: string;
  badgeCount?: number;
  detail?: ItemDetailData;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDestructive?: boolean;
}

export default function ItemRequestCard({
  requestedBy = "Requested by:",
  section,
  time,
  price = "$$$",
  variant = "requested",
  typeBadge,
  urgency,
  badgeCount,
  detail,
  onClick,
  onEdit,
  onDelete,
  deleteLabel,
  deleteDestructive = true,
}: ItemRequestCardProps) {
  const hasLocation = section && section !== "—";
  const hasDate = time && time !== "—";
  const imageUrl = detail?.imageUrl;
  const isOffer = variant === "lent";

  const accentText = isOffer ? "text-[#DEA440]" : "text-[#3761B0]";
  const badgeClasses = isOffer
    ? "text-[#DEA440] bg-amber-50"
    : "text-[#3761B0] bg-blue-50";
  const placeholderClasses = isOffer
    ? "bg-amber-50 text-[#DEA440]"
    : "bg-blue-50 text-[#3761B0]";
  const PlaceholderIcon = isOffer ? TagFill : QuestionCircleFill;

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
      className={`w-full text-left bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-colors focus:outline-none flex flex-row ${
        onClick || onEdit || onDelete
          ? "cursor-pointer hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
          : ""
      }`}
    >
      {/* Image area — square left thumbnail; fit (no crop) */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 shrink-0 self-start bg-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={detail?.title ?? "Post image"}
            fill
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain"
          />
        ) : (
          <div
            className={`flex items-center justify-center h-full w-full ${placeholderClasses}`}
          >
            <PlaceholderIcon size={40} className="opacity-70" />
          </div>
        )}
        {typeBadge && (
          <span
            className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeClasses}`}
          >
            {typeBadge}
          </span>
        )}
        {badgeCount != null && badgeCount > 0 && (
          <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-3 flex flex-col gap-1">
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
          {detail?.title ?? "Item"}
        </h3>
        <p className="text-xs text-gray-600 truncate">
          {variant === "lent"
            ? requestedBy.replace(/^Offered by:/i, "Lent by:")
            : requestedBy}
        </p>
        {urgency && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
            <Clock size={11} className="shrink-0" />
            {urgency}
          </span>
        )}
        <div className="mt-auto flex justify-between items-end gap-2 pt-1">
          {onEdit || onDelete ? (
            <div className="flex gap-1.5">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="px-2.5 py-0.5 text-xs font-medium border border-gray-300 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className={`px-2.5 py-0.5 text-xs font-medium border rounded-full transition-colors ${
                    deleteDestructive
                      ? "border-red-300 text-red-600 hover:bg-red-50"
                      : "border-gray-300 text-gray-600 hover:border-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {deleteLabel ?? "Delete"}
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
          <span
            className={`font-semibold text-sm ml-auto truncate max-w-[55%] ${accentText}`}
          >
            {price}
          </span>
        </div>
      </div>
    </div>
  );
}
