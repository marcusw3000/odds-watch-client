import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Heart, SortAsc, SortDesc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MarketFilters } from '@/hooks/useMarketFilters';
import { MarketStatus, MARKET_STATUS_LABELS } from '@/types/market';
import { cn } from '@/lib/utils';

interface AdvancedFiltersProps {
  filters: MarketFilters;
  onUpdateFilter: <K extends keyof MarketFilters>(key: K, value: MarketFilters[K]) => void;
  onClearFilters: () => void;
  categories: string[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  isLoggedIn: boolean;
}

export function AdvancedFilters({
  filters,
  onUpdateFilter,
  onClearFilters,
  categories,
  hasActiveFilters,
  activeFilterCount,
  isLoggedIn,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions: MarketStatus[] = ['OPEN', 'HALTED', 'PENDING_SETTLEMENT', 'SETTLED'];

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onUpdateFilter('categories', newCategories);
  };

  const toggleStatus = (status: MarketStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onUpdateFilter('statuses', newStatuses);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 flex-wrap">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <>
            {filters.showFavoritesOnly && (
              <Badge variant="secondary" className="gap-1">
                <Heart className="h-3 w-3 fill-current" />
                Favoritos
                <button
                  onClick={() => onUpdateFilter('showFavoritesOnly', false)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="gap-1">
                {cat}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.statuses.map((status) => (
              <Badge key={status} variant="secondary" className="gap-1">
                {MARKET_STATUS_LABELS[status]}
                <button
                  onClick={() => toggleStatus(status)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground"
            >
              Limpar filtros
            </Button>
          </>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="p-4 rounded-lg border border-border bg-card space-y-6">
          {/* Favorites Toggle */}
          {isLoggedIn && (
            <div className="flex items-center justify-between">
              <Label htmlFor="favorites-only" className="flex items-center gap-2 cursor-pointer">
                <Heart className={cn("h-4 w-4", filters.showFavoritesOnly && "fill-pink-500 text-pink-500")} />
                Mostrar apenas favoritos
              </Label>
              <Switch
                id="favorites-only"
                checked={filters.showFavoritesOnly}
                onCheckedChange={(checked) => onUpdateFilter('showFavoritesOnly', checked)}
              />
            </div>
          )}

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categorias</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={filters.categories.includes(cat) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  variant={filters.statuses.includes(status) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleStatus(status)}
                >
                  {MARKET_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>

          {/* Probability Range */}
          <div className="space-y-3">
            <Label>Probabilidade SIM</Label>
            <div className="px-2">
              <Slider
                value={[filters.probabilityRange[0], filters.probabilityRange[1]]}
                onValueChange={([min, max]) => onUpdateFilter('probabilityRange', [min, max])}
                min={0}
                max={100}
                step={5}
                className="py-4"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{filters.probabilityRange[0]}%</span>
              <span>{filters.probabilityRange[1]}%</span>
            </div>
          </div>

          {/* Sort */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select
                value={filters.sortBy}
                onValueChange={(v) => onUpdateFilter('sortBy', v as MarketFilters['sortBy'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="created">Data de criação</SelectItem>
                  <SelectItem value="closing">Data de fechamento</SelectItem>
                  <SelectItem value="probability">Probabilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <div className="flex gap-2">
                <Button
                  variant={filters.sortOrder === 'desc' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => onUpdateFilter('sortOrder', 'desc')}
                >
                  <SortDesc className="h-4 w-4 mr-1" />
                  Maior
                </Button>
                <Button
                  variant={filters.sortOrder === 'asc' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => onUpdateFilter('sortOrder', 'asc')}
                >
                  <SortAsc className="h-4 w-4 mr-1" />
                  Menor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
