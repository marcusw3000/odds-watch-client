import { TrendingUp, BarChart3, Activity, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyPaperRanking } from "@/hooks/usePaperLeaderboard";
import { useMyLeaderboardProfile } from "@/hooks/useLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";

const usd = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);

export function MyStatsCard() {
  const { data: stats, isLoading, isError } = useMyPaperRanking();
  const { data: profile } = useMyLeaderboardProfile();
  if (isLoading) return <Card><CardHeader><CardTitle>Suas estatísticas simuladas</CardTitle></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>;
  if (isError || !stats) return <p role="alert" className="text-sm text-destructive">Não foi possível carregar suas estatísticas simuladas.</p>;
  const items = [
    { icon: TrendingUp, label: "Lucro realizado", value: usd(stats.total_profit) },
    { icon: BarChart3, label: "ROI realizado", value: `${stats.roi_percent.toFixed(2)}%` },
    { icon: Activity, label: "Volume verificado", value: usd(stats.total_volume) },
    { icon: Trophy, label: "Operações verificadas", value: String(stats.total_trades) },
  ];
  return <Card><CardHeader><CardTitle>Suas estatísticas simuladas</CardTitle><CardDescription>{profile?.is_public ? "Seu perfil é público; a visibilidade de cada métrica segue suas preferências." : "Seu perfil está privado."} O lucro considera apenas vendas de posições verificadas.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{items.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-lg border border-border bg-muted/30 p-4"><div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="font-mono text-xl font-bold">{value}</p></div>)}</div></CardContent></Card>;
}
