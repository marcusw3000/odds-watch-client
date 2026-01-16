import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MarketTagsProps {
  tags?: string[];
  maxTags?: number;
  size?: 'sm' | 'default';
  className?: string;
}

export function MarketTags({ tags, maxTags = 3, size = 'sm', className }: MarketTagsProps) {
  if (!tags || tags.length === 0) return null;

  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const remainingCount = tags.length - displayTags.length;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {displayTags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className={cn(
            'font-normal',
            size === 'sm' && 'text-[10px] px-1.5 py-0 h-4'
          )}
        >
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className={cn(
            'font-normal text-muted-foreground',
            size === 'sm' && 'text-[10px] px-1.5 py-0 h-4'
          )}
        >
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}
