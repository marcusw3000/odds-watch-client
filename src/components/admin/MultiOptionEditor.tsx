import { useState } from 'react';
import { Plus, Trash2, GripVertical, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface MarketOption {
  id?: string;
  label: string;
  description?: string;
  imageUrl?: string;
  probability: number;
  displayOrder: number;
}

interface MultiOptionEditorProps {
  options: MarketOption[];
  onChange: (options: MarketOption[]) => void;
  disabled?: boolean;
  minOptions?: number;
  maxOptions?: number;
}

export function MultiOptionEditor({
  options,
  onChange,
  disabled = false,
  minOptions = 2,
  maxOptions = 10,
}: MultiOptionEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const probabilitySum = options.reduce((sum, opt) => sum + opt.probability, 0);
  const isValidSum = probabilitySum >= 99 && probabilitySum <= 101;

  const addOption = () => {
    if (options.length >= maxOptions) return;

    // Distribute remaining probability to new option
    const remaining = Math.max(0, 100 - probabilitySum);
    const newProb = remaining > 0 ? remaining : Math.round(100 / (options.length + 1));

    const newOption: MarketOption = {
      label: '',
      probability: newProb,
      displayOrder: options.length,
    };

    onChange([...options, newOption]);
  };

  const removeOption = (index: number) => {
    if (options.length <= minOptions) return;

    const newOptions = options.filter((_, i) => i !== index);
    // Redistribute probability
    const removedProb = options[index].probability;
    const probPerOption = removedProb / newOptions.length;
    
    const redistributed = newOptions.map((opt, i) => ({
      ...opt,
      probability: Math.round(opt.probability + probPerOption),
      displayOrder: i,
    }));

    // Fix rounding to ensure sum = 100
    const sum = redistributed.reduce((s, o) => s + o.probability, 0);
    if (sum !== 100 && redistributed.length > 0) {
      redistributed[0].probability += (100 - sum);
    }

    onChange(redistributed);
  };

  const updateOption = (index: number, updates: Partial<MarketOption>) => {
    const newOptions = options.map((opt, i) => 
      i === index ? { ...opt, ...updates } : opt
    );
    onChange(newOptions);
  };

  const updateProbability = (index: number, newProb: number) => {
    const oldProb = options[index].probability;
    const diff = newProb - oldProb;

    if (diff === 0) return;

    // Distribute the difference among other options proportionally
    const others = options.filter((_, i) => i !== index);
    const othersSum = others.reduce((s, o) => s + o.probability, 0);

    const newOptions = options.map((opt, i) => {
      if (i === index) {
        return { ...opt, probability: newProb };
      }
      // Adjust proportionally
      const proportion = opt.probability / othersSum;
      const adjustment = diff * proportion;
      const adjusted = Math.max(1, Math.round(opt.probability - adjustment));
      return { ...opt, probability: adjusted };
    });

    // Fix sum to exactly 100
    const sum = newOptions.reduce((s, o) => s + o.probability, 0);
    if (sum !== 100) {
      // Adjust the first non-target option
      const adjustIndex = index === 0 ? 1 : 0;
      newOptions[adjustIndex].probability += (100 - sum);
    }

    onChange(newOptions);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOptions = [...options];
    const [dragged] = newOptions.splice(draggedIndex, 1);
    newOptions.splice(index, 0, dragged);

    // Update display orders
    const reordered = newOptions.map((opt, i) => ({ ...opt, displayOrder: i }));
    onChange(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Probability sum indicator */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg text-sm',
        isValidSum ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      )}>
        <span>Soma das probabilidades:</span>
        <span className="font-semibold">{probabilitySum}%</span>
      </div>

      {!isValidSum && (
        <Alert variant="destructive">
          <AlertDescription>
            A soma das probabilidades deve ser igual a 100%. Ajuste os valores.
          </AlertDescription>
        </Alert>
      )}

      {/* Options list */}
      <div className="space-y-3">
        {options.map((option, index) => (
          <Card
            key={index}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative transition-all',
              draggedIndex === index && 'opacity-50 scale-95',
              !disabled && 'cursor-move'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <div className="pt-2 text-muted-foreground">
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Option content */}
                <div className="flex-1 space-y-3">
                  {/* Label */}
                  <div className="space-y-1">
                    <Label className="text-xs">Opção {index + 1}</Label>
                    <Input
                      placeholder="Nome da opção (ex: Trump, Biden, Lula)"
                      value={option.label}
                      onChange={(e) => updateOption(index, { label: e.target.value })}
                      disabled={disabled}
                      className="font-medium"
                    />
                  </div>

                  {/* Description (optional) */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                    <Textarea
                      placeholder="Descrição adicional..."
                      value={option.description || ''}
                      onChange={(e) => updateOption(index, { description: e.target.value })}
                      disabled={disabled}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Image URL (optional) */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      <ImageIcon className="h-3 w-3 inline mr-1" />
                      URL da imagem (opcional)
                    </Label>
                    <Input
                      placeholder="https://..."
                      value={option.imageUrl || ''}
                      onChange={(e) => updateOption(index, { imageUrl: e.target.value })}
                      disabled={disabled}
                      className="text-sm"
                    />
                  </div>

                  {/* Probability slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Probabilidade inicial</Label>
                      <span className="text-sm font-semibold">{option.probability}%</span>
                    </div>
                    <Slider
                      value={[option.probability]}
                      onValueChange={([value]) => updateProbability(index, value)}
                      min={1}
                      max={99}
                      step={1}
                      disabled={disabled}
                      className="py-2"
                    />
                  </div>
                </div>

                {/* Remove button */}
                {options.length > minOptions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                    disabled={disabled}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add option button */}
      {options.length < maxOptions && (
        <Button
          type="button"
          variant="outline"
          onClick={addOption}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Opção ({options.length}/{maxOptions})
        </Button>
      )}

      {/* Preview */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <Label className="text-xs text-muted-foreground mb-3 block">Prévia das probabilidades</Label>
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: `hsl(${(index * 360) / options.length}, 70%, 50%)`,
                }}
              />
              <span className="text-sm font-medium truncate max-w-[120px]">
                {option.label || `Opção ${index + 1}`}
              </span>
              <span className="text-sm text-muted-foreground">{option.probability}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
