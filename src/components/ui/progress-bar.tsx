import { cn } from '@/lib/utils';

interface TopProgressBarProps {
  isLoading: boolean;
  className?: string;
}

export function TopProgressBar({ isLoading, className }: TopProgressBarProps) {
  if (!isLoading) return null;

  return (
    <div 
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] h-1 bg-muted overflow-hidden',
        className
      )}
      role="progressbar"
      aria-label="Carregando página"
      aria-busy="true"
    >
      <div 
        className="h-full w-1/2 bg-primary animate-progress-indeterminate"
      />
    </div>
  );
}
