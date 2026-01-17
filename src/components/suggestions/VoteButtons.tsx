import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  score: number;
  upvotes: number;
  downvotes: number;
  userVote?: number | null;
  onVote: (value: number) => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  direction?: 'horizontal' | 'vertical';
}

export function VoteButtons({
  score,
  userVote,
  onVote,
  disabled = false,
  size = 'md',
  direction = 'vertical'
}: VoteButtonsProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (value: number) => {
    if (isVoting || disabled) return;
    setIsVoting(true);
    try {
      await onVote(value);
    } finally {
      setIsVoting(false);
    }
  };

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22
  };

  const scoreSizes = {
    sm: 'text-sm',
    md: 'text-base font-semibold',
    lg: 'text-lg font-bold'
  };

  return (
    <div 
      className={cn(
        'flex items-center gap-0.5',
        direction === 'vertical' ? 'flex-col' : 'flex-row'
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          sizeClasses[size],
          'rounded-full transition-colors',
          userVote === 1 
            ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20' 
            : 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
        )}
        onClick={() => handleVote(1)}
        disabled={isVoting || disabled}
      >
        <ChevronUp size={iconSizes[size]} />
      </Button>

      <span 
        className={cn(
          scoreSizes[size],
          'min-w-[2rem] text-center',
          score > 0 ? 'text-green-500' : score < 0 ? 'text-red-500' : 'text-muted-foreground'
        )}
      >
        {score}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          sizeClasses[size],
          'rounded-full transition-colors',
          userVote === -1 
            ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' 
            : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10'
        )}
        onClick={() => handleVote(-1)}
        disabled={isVoting || disabled}
      >
        <ChevronDown size={iconSizes[size]} />
      </Button>
    </div>
  );
}
