import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function OddsBadgeSkeleton() {
  return (
    <div className="inline-flex flex-col items-center rounded-lg px-3 py-1.5 bg-muted">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-10 mt-1" />
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-card">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

export function ContractCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Card>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3">
      <Skeleton className="h-6 w-8" />
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}
