import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Eye, Pause, CheckCircle } from 'lucide-react';
import { AdminDataProvider } from '@/services/AdminDataProvider';
import { MarketEvent } from '@/types/market';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const statusConfig = {
  OPEN: { label: 'Aberto', color: 'bg-success/10 text-success border-success/20' },
  HALTED: { label: 'Pausado', color: 'bg-warning/10 text-warning border-warning/20' },
  PENDING: { label: 'Aguardando', color: 'bg-primary/10 text-primary border-primary/20' },
  CONTESTED: { label: 'Contestado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  SETTLED: { label: 'Liquidado', color: 'bg-muted text-muted-foreground border-border' },
};

export function AdminMarketsPage() {
  const [markets, setMarkets] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadMarkets = async () => {
    const data = await AdminDataProvider.getMarkets();
    setMarkets(data);
    setLoading(false);
  };

  useEffect(() => { loadMarkets(); }, []);

  const handleForceHalt = async (market: MarketEvent) => {
    await AdminDataProvider.forceHalt(market.id, 'Halt manual pelo admin');
    toast.success('Mercado pausado');
    loadMarkets();
  };

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mercados</h1>
        <Button asChild><Link to="/admin/markets/new"><Plus className="mr-2 h-4 w-4" />Novo Mercado</Link></Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar mercados..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="OPEN">Aberto</SelectItem>
            <SelectItem value="HALTED">Pausado</SelectItem>
            <SelectItem value="PENDING">Aguardando</SelectItem>
            <SelectItem value="CONTESTED">Contestado</SelectItem>
            <SelectItem value="SETTLED">Liquidado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Odds</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Halt Em</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMarkets.map((market) => (
              <TableRow key={market.id}>
                <TableCell className="max-w-xs truncate font-medium">{market.title}</TableCell>
                <TableCell><Badge variant="outline">{market.category}</Badge></TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(statusConfig[market.status].color)}>
                    {statusConfig[market.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <span className="text-success">{market.outcomes.YES.price}%</span>
                  {' / '}
                  <span className="text-destructive">{market.outcomes.NO.price}%</span>
                </TableCell>
                <TableCell>R$ {(market.volume || 0).toLocaleString('pt-BR')}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(market.tradingHaltAt, "dd/MM HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={`/admin/markets/${market.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to={`/market/${market.id}`}><Eye className="mr-2 h-4 w-4" />Ver no Site</Link></DropdownMenuItem>
                      {market.status === 'OPEN' && (
                        <DropdownMenuItem onClick={() => handleForceHalt(market)}><Pause className="mr-2 h-4 w-4" />Forçar Halt</DropdownMenuItem>
                      )}
                      {market.status === 'PENDING' && (
                        <DropdownMenuItem asChild><Link to={`/admin/markets/${market.id}`}><CheckCircle className="mr-2 h-4 w-4" />Submeter Resultado</Link></DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
