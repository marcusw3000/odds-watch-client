import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Carregando...' }: PageLoaderProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
      role="status"
      aria-label={message}
    >
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-muted animate-spin border-t-primary" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">
        {message}
      </p>
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={className} role="status" aria-label="Carregando">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}
