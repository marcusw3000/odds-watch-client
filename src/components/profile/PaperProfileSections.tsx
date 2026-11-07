import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PaperProfileData } from '@/hooks/usePaperProfile';

const usd = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(value);
const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);

export function PaperProfileStats({ data }: { data: PaperProfileData }) {
  const winRate = data.sales_count === null || data.winning_sales === null ? null
    : data.sales_count ? 100 * data.winning_sales / data.sales_count : 0;
  const stats: [string, string | null][] = [
    ['Lucro realizado', data.total_profit === null ? null : usd(data.total_profit)],
    ['ROI realizado', data.roi_percent === null ? null : `${number(data.roi_percent)}%`],
    ['Volume verificado', data.total_volume === null ? null : usd(data.total_volume)],
    ['Operações verificadas', data.total_trades === null ? null : number(data.total_trades)],
    ['Vendas com lucro', winRate === null ? null : `${number(winRate)}%`],
    ['Melhor venda', data.best_trade_profit === null ? null : usd(data.best_trade_profit)],
    ['Sequência atual', data.current_streak === null ? null : `${data.current_streak} vendas`],
    ['Melhor sequência', data.best_streak === null ? null : `${data.best_streak} vendas`],
  ];
  return <><p className="mb-3 text-sm text-muted-foreground">Paper trading em USD virtual. Lucro, ROI e sequências consideram vendas verificadas da rodada atual; posições abertas e operações legadas não pontuam.</p>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{stats.map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-mono text-xl font-bold">{value ?? 'Oculto'}</p></CardContent></Card>)}</div>
  </>;
}

export function PaperProfileAchievements({ data }: { data: PaperProfileData }) {
  const items = [
    { label: 'Primeira operação', value: data.total_trades, target: 1, unit: 'operações' },
    { label: '10 operações', value: data.total_trades, target: 10, unit: 'operações' },
    { label: '50 operações', value: data.total_trades, target: 50, unit: 'operações' },
    { label: 'Primeira venda com lucro', value: data.winning_sales, target: 1, unit: 'vendas' },
    { label: 'Volume de US$ 1.000', value: data.total_volume, target: 1000, unit: 'USD' },
    { label: 'Lucro realizado de US$ 100', value: data.total_profit, target: 100, unit: 'USD' },
    { label: 'Três vendas lucrativas seguidas', value: data.best_streak, target: 3, unit: 'vendas' },
  ];
  return <><p className="mb-3 text-sm text-muted-foreground">Conquistas do simulador calculadas pela rodada atual. O progresso é reiniciado com a carteira.</p><div className="grid gap-4 sm:grid-cols-2">{items.map(item => {
    const progress = item.value === null ? null : Math.max(0, Math.min(100, 100 * item.value / item.target));
    return <Card key={item.label}><CardContent className="space-y-3 p-4"><div className="flex justify-between gap-2"><span className="font-medium">{item.label}</span><span className="text-sm text-muted-foreground">{progress === null ? 'Oculto' : progress >= 100 ? 'Conquistado' : 'Em progresso'}</span></div>{progress !== null && <><Progress value={progress} /><p className="text-xs text-muted-foreground">{number(Math.max(0, item.value ?? 0))} / {number(item.target)} {item.unit}</p></>}</CardContent></Card>;
  })}</div></>;
}

export function PaperProfileHistory({ data }: { data: PaperProfileData }) {
  if (data.history === null) return <p className="text-muted-foreground">Histórico privado.</p>;
  if (!data.history.length) return <p className="text-muted-foreground">Nenhuma operação simulada nesta rodada.</p>;
  return <><p className="mb-3 text-sm text-muted-foreground">Últimas 100 operações simuladas, incluindo operações anteriores à validação do ranking.</p><div className="space-y-2">{data.history.map(trade => <Card key={trade.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><Link className="font-medium hover:underline" to={`/polymarket/market/${encodeURIComponent(trade.market_id)}`}>{trade.question}</Link><p className="text-sm text-muted-foreground">{trade.side === 'BUY' ? 'Compra' : 'Venda'} · {trade.outcome_label} · {new Date(trade.created_at).toLocaleString('pt-BR')}</p></div>{trade.shares !== null && trade.price !== null && trade.notional_usd !== null && <div className="text-sm sm:text-right"><p>{number(trade.shares)} shares · {number(trade.price * 100)}¢ por share</p><p className="text-muted-foreground">Total: {usd(trade.notional_usd)}</p></div>}</CardContent></Card>)}</div></>;
}
