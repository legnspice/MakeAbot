import { Skeleton } from "@/components/ui/skeleton";

function ItemCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-row">
      {/* Left square thumbnail (matches the real card's fixed thumb) */}
      <Skeleton className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 shrink-0 self-start rounded-none" />

      {/* Right content */}
      <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
        {/* Title (up to 2 lines) */}
        <Skeleton className="w-3/4 h-4 rounded" />
        {/* Poster line: avatar + name */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-4.5 h-4.5 rounded-full shrink-0" />
          <Skeleton className="w-1/2 h-3 rounded" />
        </div>
        {/* Price, bottom-right (urgency omitted — only request cards have it) */}
        <div className="mt-auto flex justify-end pt-1">
          <Skeleton className="w-12 h-4 rounded" />
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <main className="px-4 py-6 pb-28 md:pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 max-w-7xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
