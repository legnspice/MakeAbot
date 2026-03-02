import type { ItemDetailData } from '@/components/ui/item-detail-modal';

export interface ItemRequestCardProps {
  imageUrl?: string;
  requestedBy?: string;
  section?: string;
  time?: string;
  price?: string;
  variant?: 'lent' | 'requested';
  /** Full item data for the detail modal when card is clicked */
  detail?: ItemDetailData;
  onClick?: () => void;
}

export default function ItemRequestCard({
  requestedBy = 'Requested by:',
  section,
  time,
  price = '$$$',
  variant = 'requested',
  detail,
  onClick,
}: ItemRequestCardProps) {
  const hasLocation = section && section !== '—';
  const hasDate = time && time !== '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-w-md hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
          {detail?.title ?? 'Item'}
        </h3>
        <p className="text-sm text-gray-600">
          {variant === 'lent'
            ? requestedBy.replace(/^Offered by:/i, 'Lent by:')
            : requestedBy}
        </p>
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