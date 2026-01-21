export function MarketCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card min-h-[280px] flex flex-col p-4">
      {/* Header */}
      <div className="flex items-start gap-3 min-h-[56px]">
        <div className="w-10 h-10 rounded-full bg-muted animate-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 rounded bg-muted animate-shimmer" />
          <div className="h-4 w-full rounded bg-muted animate-shimmer" />
          <div className="h-4 w-3/4 rounded bg-muted animate-shimmer" />
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-2 mt-3">
        <div className="h-5 w-14 rounded-full bg-muted animate-shimmer" />
        <div className="h-5 w-16 rounded-full bg-muted animate-shimmer" />
      </div>

      {/* Status */}
      <div className="mt-2">
        <div className="h-6 w-20 rounded bg-muted animate-shimmer" />
      </div>

      {/* Buttons - centered */}
      <div className="flex-1 flex items-center gap-2 my-3">
        <div className="flex-1 h-10 rounded-md bg-muted animate-shimmer" />
        <div className="flex-1 h-10 rounded-md bg-muted animate-shimmer" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 rounded bg-muted animate-shimmer" />
          <div className="h-4 w-16 rounded bg-muted animate-shimmer" />
        </div>
        <div className="h-6 w-6 rounded bg-muted animate-shimmer" />
      </div>
    </div>
  );
}
