import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserLinkProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  showAvatar?: boolean;
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  nameClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const sizeClasses = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

const fallbackTextSizes = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-sm',
};

export function UserLink({
  userId,
  displayName,
  avatarUrl,
  showAvatar = true,
  avatarSize = 'sm',
  className,
  nameClassName,
  onClick,
}: UserLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
  };

  return (
    <Link
      to={`/profile/${userId}`}
      className={cn(
        'inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity',
        className
      )}
      onClick={handleClick}
    >
      {showAvatar && (
        <Avatar
          className={cn(
            sizeClasses[avatarSize],
            'hover:ring-2 hover:ring-primary/50 transition-all'
          )}
        >
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className={fallbackTextSizes[avatarSize]}>
            {displayName?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      <span
        className={cn(
          'hover:text-primary hover:underline transition-colors',
          nameClassName
        )}
      >
        {displayName}
      </span>
    </Link>
  );
}
