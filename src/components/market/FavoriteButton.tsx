import { memo, useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FavoriteButtonProps {
  marketId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const FavoriteButton = memo(function FavoriteButton({
  marketId,
  size = 'md',
  showLabel = false,
  className,
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, isAddingFavorite, isRemovingFavorite } = useFavorites();
  const [justFavorited, setJustFavorited] = useState(false);

  const isFav = isFavorite(marketId);
  const isLoading = isAddingFavorite || isRemovingFavorite;

  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  };

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      navigate('/auth', { state: { returnTo: `/market/${marketId}` } });
      return;
    }

    // Show animation and toast when adding to favorites
    if (!isFav) {
      setJustFavorited(true);
      setTimeout(() => setJustFavorited(false), 600);
      toast({
        title: 'Adicionado aos favoritos',
        description: 'Acesse seus favoritos no menu de perfil',
        duration: 2000,
      });
    }

    toggleFavorite(marketId);
  };

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        sizeClasses[size],
        'transition-all duration-200',
        isFav && 'text-pink-500 hover:text-pink-600',
        !isFav && 'text-muted-foreground hover:text-pink-500',
        isLoading && 'opacity-50 pointer-events-none',
        className
      )}
      onClick={handleClick}
      disabled={isLoading}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-transform duration-200',
          isFav && 'fill-current scale-110',
          !isFav && 'hover:scale-110',
          justFavorited && 'animate-heartbeat'
        )}
      />
    </Button>
  );

  if (showLabel) {
    return (
      <Button
        variant={isFav ? 'secondary' : 'outline'}
        size={size === 'lg' ? 'default' : 'sm'}
        className={cn(
          'transition-all duration-200',
          isFav && 'text-pink-500 border-pink-500/30 bg-pink-500/10',
          !isFav && 'text-muted-foreground hover:text-pink-500',
          isLoading && 'opacity-50 pointer-events-none',
          className
        )}
        onClick={handleClick}
        disabled={isLoading}
      >
        <Heart
          className={cn(
            iconSizes[size],
            'mr-2',
            isFav && 'fill-current',
            justFavorited && 'animate-heartbeat'
          )}
        />
        {isFav ? 'Salvo' : 'Salvar'}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent>
        {isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      </TooltipContent>
    </Tooltip>
  );
});
