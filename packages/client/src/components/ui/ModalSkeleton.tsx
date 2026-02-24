/**
 * Cyberpunk-themed skeleton placeholder shown while lazy modal chunks load.
 * Used as the Suspense fallback in ModalRouter.
 */
export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Skeleton panel */}
      <div className="relative w-full max-w-lg bg-bg-surface border border-border-default rounded-lg overflow-hidden">
        {/* Header skeleton */}
        <div className="px-4 py-3 border-b border-border-default">
          <div className="skeleton-bar h-4 w-32 rounded" />
        </div>

        {/* Content skeleton */}
        <div className="p-5 space-y-4">
          <div className="skeleton-bar h-3 w-full rounded" />
          <div className="skeleton-bar h-3 w-3/4 rounded" />
          <div className="skeleton-bar h-3 w-5/6 rounded" />
          <div className="h-4" />
          <div className="flex gap-3">
            <div className="skeleton-bar h-10 flex-1 rounded" />
            <div className="skeleton-bar h-10 flex-1 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
