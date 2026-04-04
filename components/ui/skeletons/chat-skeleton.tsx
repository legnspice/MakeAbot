import { Skeleton } from "@/components/ui/skeleton";

function ConversationEntrySkeleton() {
  return (
    <div className="w-full px-5 py-4 border-b border-gray-100 flex flex-col gap-1.5">
      <Skeleton className="w-3/4 h-4 rounded" />
      <Skeleton className="w-1/2 h-3 rounded" />
    </div>
  );
}

/** Desktop sidebar skeleton */
export function ChatSidebarSkeleton() {
  return (
    <div className="w-96 border-r border-gray-200 shrink-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <ConversationEntrySkeleton key={i} />
      ))}
    </div>
  );
}

/** Mobile chat loading (full-width list) */
export function ChatMobileSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {Array.from({ length: 6 }).map((_, i) => (
        <ConversationEntrySkeleton key={i} />
      ))}
    </div>
  );
}
