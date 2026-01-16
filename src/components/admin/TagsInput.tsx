import { useState, useEffect, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Predefined tags suggestions
const SUGGESTED_TAGS = [
  'Taxa de Juros',
  'Câmbio',
  'Inflação',
  'PIB',
  'Política Monetária',
  'COPOM',
  'BCB',
  'FED',
  'Dólar',
  'Euro',
  'Renda Fixa',
  'Renda Variável',
  'Commodities',
  'Bolsa',
  'Ibovespa',
  'S&P500',
  'Criptomoedas',
  'Bitcoin',
  'Eleições',
  'Geopolítica',
  'Energia',
  'Petróleo',
  'Fiscal',
  'Orçamento',
];

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function TagsInput({ value, onChange, disabled, error }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = SUGGESTED_TAGS.filter(
    (tag) =>
      !value.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 8);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !value.includes(trimmedTag)) {
      onChange([...value, trimmedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      
      {/* Current tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="ml-1 hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma tag e pressione Enter..."
          disabled={disabled}
          className={error ? 'border-destructive' : ''}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
            {filteredSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
              >
                <Plus className="h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Quick add suggestions */}
      {value.length < 5 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground mr-1">Sugestões:</span>
          {SUGGESTED_TAGS.filter((tag) => !value.includes(tag))
            .slice(0, 5)
            .map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addTag(tag)}
                disabled={disabled}
                className="h-5 px-2 text-xs"
              >
                + {tag}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
