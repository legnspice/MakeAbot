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
  imageUrl,
  requestedBy = 'Requested by:',
  section,
  time,
  price = '$$$',
  variant = 'requested',
  detail,
  onClick,
}: ItemRequestCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-w-md hover:border-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0] focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-4">
        {/* Image placeholder */}
        <div className="shrink-0">
          <div className="w-20 h-20 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 text-sm font-medium">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt="item" 
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              'item_image'
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">
            {detail?.title ?? 'Item'}
          </h3>
          {variant === 'lent' ? (
            <>
              <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
                <span>{requestedBy}</span>
                <span className="text-gray-900 font-medium shrink-0">{price}</span>
              </div>
              {(section || time) && (section !== '—' || time !== '—') && (
                <div className="mt-1.5 text-sm text-blue-600 font-medium flex flex-wrap gap-x-2 gap-y-0">
                  {section && section !== '—' && <span>{section}</span>}
                  {time && time !== '—' && <span>{time}</span>}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-1.5">{requestedBy}</p>
              <div className="flex items-center gap-4 text-blue-600 font-medium flex-wrap">
                {section && section !== '—' && <span>{section}</span>}
                {time && time !== '—' && <span>{time}</span>}
                <span className="text-gray-900 ml-auto">{price}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}