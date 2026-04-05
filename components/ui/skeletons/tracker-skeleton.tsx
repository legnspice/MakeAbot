import { Skeleton } from "@/components/ui/skeleton";

function TrackerCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Item name */}
      <Skeleton className="w-3/4 h-5 rounded mb-1.5" />
      {/* Type label */}
      <Skeleton className="w-14 h-3.5 rounded mt-1" />
      {/* Bottom row: avatars + price/count */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-full border-2 border-white" />
          ))}
        </div>
        <Skeleton className="w-16 h-4 rounded" />
      </div>
    </div>
  );
}

export function TrackerPageSkeleton() {
  return (
    <main className="flex-1 px-4 pt-4 pb-28 md:pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <TrackerCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
