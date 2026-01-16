import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, BarChart3, Activity, EyeOff } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyWithSign, formatPercent } from '@/lib/formatters';
import type { LeaderboardEntry, LeaderboardSortBy } from '@/types/leaderboard';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  sortBy: LeaderboardSortBy;
  onSortChange: (sort: LeaderboardSortBy) => void;
  currentUserId?: string;
}

export function LeaderboardTable({ 
  entries, 
  isLoading, 
  sortBy, 
  onSortChange,
  currentUserId 
}: LeaderboardTableProps) {
  // Using formatCurrencyWithSign and formatPercent from @/lib/formatters
  const formatCurrency = (value: number) => formatCurrencyWithSign(value);
  const formatPercentage = (value: number) => formatPercent(value);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="text-muted-foreground font-mono">#{rank}</span>;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const SortableHeader = ({ 
    column, 
    label, 
    icon: Icon 
  }: { 
    column: LeaderboardSortBy; 
    label: string; 
    icon: React.ElementType;
  }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${sortBy === column ? 'text-primary' : ''}`}
      onClick={() => onSortChange(column)}
    >
      <div className="flex items-center gap-1">
        <Icon className="h-4 w-4" />
        {label}
        {sortBy === column && <span className="text-xs">▼</span>}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum trader no leaderboard ainda</p>
        <p className="text-sm">Seja o primeiro a participar!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Trader</TableHead>
            <SortableHeader column="profit" label="Lucro" icon={TrendingUp} />
            <SortableHeader column="roi" label="ROI" icon={BarChart3} />
            <SortableHeader column="volume" label="Volume" icon={Activity} />
            <SortableHeader column="trades" label="Trades" icon={Trophy} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCurrentUser = currentUserId === entry.user_id;
            
            return (
              <TableRow 
                key={entry.user_id}
                className={isCurrentUser ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
              >
                <TableCell className="font-medium">
                  {getRankBadge(entry.rank)}
                </TableCell>
                <TableCell>
                  <Link 
                    to={`/profile/${entry.user_id}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(entry.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium hover:underline">{entry.display_name}</span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  {entry.show_profit ? (
                    <span className={entry.total_profit >= 0 ? 'text-green-500 font-mono' : 'text-red-500 font-mono'}>
                      {formatCurrency(entry.total_profit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Oculto
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {entry.show_roi ? (
                    <span className={entry.roi_percent >= 0 ? 'text-green-500 font-mono' : 'text-red-500 font-mono'}>
                      {formatPercentage(entry.roi_percent)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Oculto
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {entry.show_volume ? (
                    <span className="font-mono text-muted-foreground">
                      R${entry.total_volume.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Oculto
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {entry.show_trades ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{entry.total_trades}</span>
                      <span className="text-xs text-muted-foreground">
                        ({entry.winning_trades}W)
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Oculto
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
