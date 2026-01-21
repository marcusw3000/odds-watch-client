import { memo } from 'react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
  categoryCounts?: Record<string, number>;
  totalCount?: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; activeBg: string; text: string; icon: string }> = {
  Economia: { bg: 'bg-blue-500/10', activeBg: 'bg-blue-500', text: 'text-blue-400', icon: '🏛️' },
  Câmbio: { bg: 'bg-amber-500/10', activeBg: 'bg-amber-500', text: 'text-amber-400', icon: '💱' },
  Política: { bg: 'bg-purple-500/10', activeBg: 'bg-purple-500', text: 'text-purple-400', icon: '🗳️' },
  Esportes: { bg: 'bg-green-500/10', activeBg: 'bg-green-500', text: 'text-green-400', icon: '⚽' },
  Mercado: { bg: 'bg-indigo-500/10', activeBg: 'bg-indigo-500', text: 'text-indigo-400', icon: '📈' },
  Inflação: { bg: 'bg-rose-500/10', activeBg: 'bg-rose-500', text: 'text-rose-400', icon: '📊' },
  'Política Monetária': { bg: 'bg-cyan-500/10', activeBg: 'bg-cyan-500', text: 'text-cyan-400', icon: '🏦' },
};

const DEFAULT_CATEGORY = { bg: 'bg-secondary', activeBg: 'bg-primary', text: 'text-secondary-foreground', icon: '📊' };

export const CategoryFilter = memo(function CategoryFilter({
  categories,
  activeCategory,
  onSelect,
  categoryCounts = {},
  totalCount = 0,
}: CategoryFilterProps) {
  const getCategoryStyle = (category: string) => CATEGORY_COLORS[category] || DEFAULT_CATEGORY;
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
        const style = getCategoryStyle(category);
        const isActive = activeCategory === category;
        
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-1.5",
              isActive
                ? cn(style.activeBg, "text-white shadow-md")
                : cn(style.bg, style.text, "hover:opacity-80")
            )}
          >
            <span className="text-sm">{style.icon}</span>
            {category}
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums",
                isActive 
                  ? "bg-white/20" 
                  : "bg-current/10"
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
