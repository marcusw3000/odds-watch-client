import { memo } from 'react';
import { Search, X, Filter, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MarketEmptyStateProps {
  searchQuery: string;
  activeCategory: string | null;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onClearSearch: () => void;
  onClearCategory: () => void;
  onSelectCategory: (category: string) => void;
  suggestedCategories?: string[];
}

export const MarketEmptyState = memo(function MarketEmptyState({
  searchQuery,
  activeCategory,
  hasActiveFilters,
  onClearFilters,
  onClearSearch,
  onClearCategory,
  onSelectCategory,
  suggestedCategories = [],
}: MarketEmptyStateProps) {
  const hasAnyFilter = searchQuery || activeCategory || hasActiveFilters;

  return (
    <div className="text-center py-16 space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        {searchQuery ? (
          <Search className="h-8 w-8 text-muted-foreground/50" />
        ) : (
          <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-1">Nenhum mercado encontrado</h3>
        
        {searchQuery ? (
          <p className="text-muted-foreground text-sm">
            Não encontramos resultados para "<span className="font-medium">{searchQuery}</span>"
          </p>
        ) : hasAnyFilter ? (
          <p className="text-muted-foreground text-sm">
            Nenhum mercado corresponde aos filtros selecionados
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Não há mercados disponíveis no momento
          </p>
        )}
      </div>

      {/* Action buttons */}
      {hasAnyFilter && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Tente:</p>
          
          <div className="flex flex-wrap justify-center gap-2">
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={onClearSearch}>
                <X className="h-3 w-3 mr-1" />
                Limpar busca
              </Button>
            )}
            
            {activeCategory && (
              <Button variant="outline" size="sm" onClick={onClearCategory}>
                <X className="h-3 w-3 mr-1" />
                Ver todas categorias
              </Button>
            )}
            
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                <Filter className="h-3 w-3 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Suggested categories */}
      {suggestedCategories.length > 0 && !searchQuery && (
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">
            Categorias populares:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedCategories.slice(0, 4).map(cat => (
              <Badge 
                key={cat} 
                variant="secondary" 
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => onSelectCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
