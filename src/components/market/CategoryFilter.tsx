import { memo } from 'react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
  totalCount?: number;
}

export const CategoryFilter = memo(function CategoryFilter({
  categories,
  activeCategory,
  onSelect,
  categoryCounts = {},
  totalCount = 0,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5",
          activeCategory === null
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-accent"
        )}
      >
        Todos
        {totalCount > 0 && (
          <span className={cn(
            "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums",
            activeCategory === null 
              ? "bg-primary-foreground/20" 
              : "bg-muted-foreground/20"
          )}>
            {totalCount}
          </span>
        )}
      </button>
      {categories.map((category) => {
        const count = categoryCounts[category];
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5",
              activeCategory === category
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            {category}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums",
                activeCategory === category 
                  ? "bg-primary-foreground/20" 
                  : "bg-muted-foreground/20"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
