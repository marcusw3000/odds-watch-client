import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Clock, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatters';
import type { UserProfile } from '@/types/leaderboard';

interface PublicTradeHistoryProps {
  userId: string;
  profile: UserProfile;
  isOwnProfile: boolean;
}

interface PublicTrade {
  id: string;
  type: string;
  position: string | null;
  shares: number | null;
  total_amount: number;
  created_at: string;
  market: {
    id: string;
    title: string;
    status: string;
    result: string | null;
  } | null;
}

export function PublicTradeHistory({ userId, profile, isOwnProfile }: PublicTradeHistoryProps) {
  const canSeeTrades = isOwnProfile || (profile.is_public && profile.show_trades);
  const canSeeAmounts = isOwnProfile || profile.show_profit;

  const { data: trades, isLoading } = useQuery({
    queryKey: ['public-trades', userId],
    queryFn: async (): Promise<PublicTrade[]> => {
      if (!canSeeTrades) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          position,
          shares,
          total_amount,
          created_at,
          market:markets(id, title, status, result)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as PublicTrade[];
    },
    enabled: canSeeTrades,
  });

  if (!canSeeTrades) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Histórico privado</p>
            <p className="text-sm">Este usuário optou por ocultar seu histórico de trades.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Trades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum trade realizado ainda.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTradeResult = (trade: PublicTrade) => {
    if (!trade.market) return null;
    if (trade.market.status !== 'SETTLED') return 'pending';
    if (trade.market.result === trade.position) return 'won';
    return 'lost';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trades.map((trade) => {
            const result = getTradeResult(trade);
            
            return (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {trade.market?.title || 'Mercado removido'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant={trade.position === 'YES' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {trade.type === 'BUY' ? 'Compra' : 'Venda'} {trade.position}
                    </Badge>
                    {trade.shares && (
                      <span className="text-xs text-muted-foreground">
                        {trade.shares} contratos
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(trade.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {canSeeAmounts && (
                    <span className="font-mono text-sm">
                      {formatCurrency(trade.total_amount)}
                    </span>
                  )}
                  {result === 'won' && (
                    <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Ganhou
                    </Badge>
                  )}
                  {result === 'lost' && (
                    <Badge variant="default" className="bg-red-500/10 text-red-500 border-red-500/20">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Perdeu
                    </Badge>
                  )}
                  {result === 'pending' && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Aberto
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
