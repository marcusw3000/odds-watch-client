import { useState, useCallback } from 'react';
import { Trophy, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLACEMENT_LABELS, PLACEMENT_LABELS_FULL, PLACEMENT_MULTIPLIERS } from '@/lib/resultParser';
import { cn } from '@/lib/utils';

interface MarketOption {
  id: string;
  label: string;
  current_price: number;
}

interface MultiWinnerSelectorProps {
  options: MarketOption[];
  maxWinners: number;
  selectedWinners: string[];
  onChange: (winners: string[]) => void;
}

export function MultiWinnerSelector({
  options,
  maxWinners,
  selectedWinners,
  onChange,
}: MultiWinnerSelectorProps) {
  // Get available options (not yet selected)
  const getAvailableOptions = (currentPlacement: number) => {
    return options.filter(
      opt => !selectedWinners.includes(opt.id) || selectedWinners[currentPlacement] === opt.id
    );
  };

  // Handle selection for a specific placement
  const handlePlacementChange = (placement: number, optionId: string) => {
    const newWinners = [...selectedWinners];
    
    // Remove if already selected at different placement
    const existingIndex = newWinners.indexOf(optionId);
    if (existingIndex !== -1 && existingIndex !== placement) {
      newWinners[existingIndex] = '';
    }
    
    newWinners[placement] = optionId;
    
    // Clean up empty slots at the end
    while (newWinners.length > 0 && !newWinners[newWinners.length - 1]) {
      newWinners.pop();
    }
    
    onChange(newWinners.filter(Boolean));
  };

  // Remove a winner from a placement
  const handleRemove = (placement: number) => {
    const newWinners = [...selectedWinners];
    newWinners.splice(placement, 1);
    onChange(newWinners.filter(Boolean));
  };

  // Get option label by id
  const getOptionLabel = (id: string) => {
    const opt = options.find(o => o.id === id);
    return opt?.label || 'Selecione...';
  };

  const filledCount = selectedWinners.length;
  const isComplete = filledCount >= maxWinners;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Selecione os vencedores ({filledCount} de {maxWinners})
        </p>
        {isComplete && (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            ✓ Completo
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {Array.from({ length: maxWinners }).map((_, index) => {
          const selectedId = selectedWinners[index];
          const availableOptions = getAvailableOptions(index);
          const multiplier = PLACEMENT_MULTIPLIERS[index] ?? 0.1;

          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                selectedId 
                  ? "bg-accent/50 border-primary/30" 
                  : "bg-muted/30 border-dashed border-muted-foreground/30"
              )}
            >
              {/* Placement Badge */}
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-lg">
                {PLACEMENT_LABELS[index] || `${index + 1}º`}
              </div>

              {/* Selector */}
              <div className="flex-1">
                <Select
                  value={selectedId || ''}
                  onValueChange={(value) => handlePlacementChange(index, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Selecione o ${PLACEMENT_LABELS_FULL[index] || `${index + 1}º Lugar`}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-warning" />
                          <span>{option.label}</span>
                          <span className="text-muted-foreground">
                            ({Math.round(option.current_price * 100)}%)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Multiplier */}
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-medium text-primary">
                  {Math.round(multiplier * 100)}%
                </p>
                <p className="text-xs text-muted-foreground">prêmio</p>
              </div>

              {/* Remove Button */}
              {selectedId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8"
                  onClick={() => handleRemove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {selectedWinners.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border">
          <p className="text-sm font-medium mb-2">Resumo de Pagamentos:</p>
          <ul className="space-y-1">
            {selectedWinners.map((id, index) => {
              const option = options.find(o => o.id === id);
              const multiplier = PLACEMENT_MULTIPLIERS[index] ?? 0.1;
              return (
                <li key={id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {PLACEMENT_LABELS[index]} {option?.label}
                  </span>
                  <span className="font-medium">
                    {Math.round(multiplier * 100)}% do prêmio base
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
