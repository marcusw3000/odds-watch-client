import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialRepository } from '@/services/FinancialRepository';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Calendar, CheckCircle, Lock, Gavel } from 'lucide-react';

interface Market {
  id: string;
  title: string;
  status: string;
  close_date: string | null;
  settlement_date: string | null;
  total_volume: number;
  result: string | null;
  resolution: Record<string, unknown> | null;
}

export function AdminMarketEventsPage() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  // Settlement dialog
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [settlementResult, setSettlementResult] = useState<'YES' | 'NO'>('YES');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setLoading(true);
    const data = await FinancialRepository.getMarketsForSettlement();
    setMarkets(data as Market[]);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'OPEN': return 'default';
      case 'HALTED': return 'secondary';
      case 'PENDING': return 'secondary';
      case 'SETTLED': return 'outline';
      default: return 'outline';
    }
  };

  const openSettleDialog = (market: Market) => {
    setSelectedMarket(market);
    setSettlementResult('YES');
    setEvidenceUrl('');
    setSettleDialogOpen(true);
  };

  const handleSettle = async () => {
    if (!selectedMarket || !user?.id) return;

    if (!evidenceUrl.trim()) {
      toast.error('URL de evidência é obrigatória');
      return;
    }

    // Settle the market
    const success = await FinancialRepository.settleMarket(
      selectedMarket.id,
      settlementResult,
      evidenceUrl,
      user.id
    );

    if (success) {
      // Audit logging is now handled server-side via Edge Functions (service_role)
      toast.success('Mercado liquidado com sucesso');
      setSettleDialogOpen(false);
      loadMarkets();
    } else {
      toast.error('Erro ao liquidar mercado');
    }
  };

  const handleCloseMarket = async (market: Market) => {
    if (!user?.id) return;

    const { data, error } = await supabase.functions.invoke('update-admin-event', {
      method: 'POST',
      body: {
        action: 'update_status',
        eventId: market.id,
        status: 'PENDING',
      },
    });

    if (!error && !data?.error) {
      // Audit logging is now handled server-side via Edge Functions (service_role)
      toast.success('Mercado fechado - aguardando liquidação');
      loadMarkets();
    } else {
      toast.error('Erro ao fechar mercado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gavel className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Eventos / Mercados</h1>
          <p className="text-muted-foreground">
            Gerenciamento e liquidação de mercados preditivos
          </p>
        </div>
      </div>

      {/* Markets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mercados ({markets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead className="text-right">Volume Total</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((market) => (
                <TableRow key={market.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    {market.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(market.status)}>
                      {market.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {market.close_date 
                      ? format(new Date(market.close_date), 'dd/MM/yyyy HH:mm')
                      : '-'
                    }
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(market.total_volume)}
                  </TableCell>
                  <TableCell>
                    {market.result ? (
                      <Badge variant={market.result === 'YES' ? 'default' : 'destructive'}>
                        {market.result}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {market.status === 'OPEN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloseMarket(market)}
                      >
                        <Lock className="h-4 w-4 mr-1" />
                        Fechar
                      </Button>
                    )}
                    {(market.status === 'PENDING' || market.status === 'HALTED') && (
                      <Button
                        size="sm"
                        onClick={() => openSettleDialog(market)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Liquidar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {markets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum mercado aguardando ação
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidar Mercado</DialogTitle>
            <DialogDescription>
              Defina o resultado e forneça evidência para liquidar este mercado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Mercado</Label>
              <p className="p-2 bg-muted rounded font-medium">
                {selectedMarket?.title}
              </p>
            </div>

            <div>
              <Label>Volume Total</Label>
              <p className="text-lg font-bold">
                {selectedMarket && formatCurrency(selectedMarket.total_volume)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select
                value={settlementResult}
                onValueChange={(v) => setSettlementResult(v as 'YES' | 'NO')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">SIM (YES)</SelectItem>
                  <SelectItem value="NO">NÃO (NO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>URL de Evidência *</Label>
              <Input
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://fonte.com/evidencia"
              />
              <p className="text-xs text-muted-foreground">
                Link para a fonte oficial que comprova o resultado
              </p>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-sm">
              <strong>Taxa de Liquidação:</strong> Será aplicada automaticamente conforme regra configurada (padrão: 0.5% do volume).
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSettle}>
              Confirmar Liquidação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
