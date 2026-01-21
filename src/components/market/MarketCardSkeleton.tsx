export function MarketCardSkeleton() {
  return (
    <div className="grid grid-rows-[auto_32px_48px_48px_40px] min-h-[280px] p-4 rounded-xl border border-border bg-card overflow-hidden">
      {/* Zone 1: Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted animate-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-full rounded bg-muted animate-shimmer" />
          <div className="h-4 w-3/4 rounded bg-muted animate-shimmer" />
        </div>
      </div>

      {/* Zone 2: Status */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-20 rounded bg-muted animate-shimmer" />
      </div>

      {/* Zone 3: Options */}
      <div className="flex flex-col justify-center gap-1">
        <div className="flex items-center justify-between">
          <div className="h-4 w-8 rounded bg-muted animate-shimmer" />
          <div className="h-4 w-10 rounded bg-muted animate-shimmer" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-8 rounded bg-muted animate-shimmer" />
          <div className="h-4 w-10 rounded bg-muted animate-shimmer" />
        </div>
      </div>

      {/* Zone 4: Buttons */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-10 rounded-md bg-muted animate-shimmer" />
        <div className="flex-1 h-10 rounded-md bg-muted animate-shimmer" />
      </div>

      {/* Zone 5: Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 rounded bg-muted animate-shimmer" />
          <div className="h-4 w-16 rounded bg-muted animate-shimmer" />
        </div>
        <div className="h-6 w-6 rounded bg-muted animate-shimmer" />
      </div>
    </div>
  );
}
