import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page skeleton shell that mirrors Navbar + BottomNav.
 * Used by layout-level auth loading states so the page never flashes bare white.
 */
export function PageShellSkeleton({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar skeleton */}
      <nav className="flex justify-between items-center px-5 py-3 bg-white border-b border-gray-100">
        {/* Logo placeholder */}
        <Skeleton className="w-40 h-9 rounded-md" />

        {/* Desktop nav links placeholder */}
        <div className="hidden md:flex items-center gap-6">
          <Skeleton className="w-12 h-4 rounded" />
          <Skeleton className="w-24 h-4 rounded" />
          <Skeleton className="w-16 h-4 rounded" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>

        {/* Mobile icons placeholder */}
        <div className="flex md:hidden gap-5 items-center">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </nav>

      {/* Page content area */}
      <div className="flex-1">{children}</div>

      {/* BottomNav skeleton — mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#4A6FA5] z-40 min-h-[68px] flex justify-around items-center px-2 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2"
          >
            <div className="w-6 h-6 rounded bg-white/30 animate-pulse" />
            <div className="w-12 h-2.5 rounded bg-white/30 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
