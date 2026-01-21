export function MarketCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card min-h-[280px]">
      <div className="p-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="h-6 w-20 rounded-md animate-shimmer" />
          <div className="h-4 w-24 rounded animate-shimmer" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="h-5 w-full rounded animate-shimmer" />
          <div className="h-5 w-3/4 rounded animate-shimmer" />
        </div>

        {/* Odds */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-3 w-8 rounded animate-shimmer" />
            <div className="h-12 w-20 rounded-lg animate-shimmer" />
          </div>
          <div className="h-12 w-px bg-border" />
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-3 w-8 rounded animate-shimmer" />
            <div className="h-12 w-20 rounded-lg animate-shimmer" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 rounded animate-shimmer" />
          <div className="h-4 w-28 rounded animate-shimmer" />
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 border-t border-border">
        <div className="h-14 border-r border-border animate-shimmer" />
        <div className="h-14 animate-shimmer" />
      </div>
    </div>
  );
}
