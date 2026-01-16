import { Skeleton } from '@/components/ui/skeleton';

interface NotificationSkeletonProps {
  count?: number;
}

export function NotificationSkeleton({ count = 3 }: NotificationSkeletonProps) {
  return (
    <div className="divide-y divide-border">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="p-4 flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
