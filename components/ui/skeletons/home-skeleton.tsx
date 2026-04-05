import { Skeleton } from "@/components/ui/skeleton";

function ItemCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Type badge */}
      <Skeleton className="w-14 h-5 rounded mb-2" />
      <div className="flex flex-col gap-1.5">
        {/* Title */}
        <Skeleton className="w-3/4 h-5 rounded" />
        {/* "Offered by / Requested by" */}
        <Skeleton className="w-1/2 h-3.5 rounded" />
        {/* Description — desktop only */}
        <Skeleton className="hidden md:block w-full h-3 rounded" />
        <Skeleton className="hidden md:block w-5/6 h-3 rounded" />
      </div>
      {/* Price row */}
      <div className="mt-3 flex justify-end">
        <Skeleton className="w-12 h-4 rounded" />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <main className="px-4 py-6 pb-28 md:pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
