import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderSearchProps {
  className?: string;
}

/** Search entry point for the public Polymarket catalog. */
export function HeaderSearch({ className }: HeaderSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    navigate(normalized ? `/polymarket?q=${encodeURIComponent(normalized)}` : '/polymarket');
  };

  return (
    <form className={cn('relative', className)} onSubmit={submit} role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Buscar na Polymarket..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-10 w-full border-transparent bg-secondary pl-10 pr-10 focus:border-primary md:w-[280px] lg:w-[320px]"
      />
      {query && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
