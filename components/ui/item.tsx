interface ItemRequestCardProps {
  imageUrl?: string;
  requestedBy?: string;
  section?: string;
  time?: string;
  price?: string;
}

export default function ItemRequestCard({
  imageUrl,
  requestedBy = 'Requested by:',
  section = 'SEC-A206',
  time = '5:00 P.M.',
  price = '$$$'
}: ItemRequestCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-w-md">
      <div className="flex items-start gap-4">
        {/* Image placeholder */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-sm font-medium">
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
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">ITEM</h3>
          <p className="text-sm text-gray-600 mb-3">{requestedBy}</p>
          
          {/* Details row */}
          <div className="flex items-center gap-4 text-blue-600 font-medium">
            <span>{section}</span>
            <span>{time}</span>
            <span>{price}</span>
          </div>
        </div>
      </div>
    </div>
  );
}