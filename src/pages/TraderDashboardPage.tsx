import { useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  TrendingUp,
  DollarSign,
  Copy,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyTraderStatus, useMyFollowers, useMyCommissions } from "@/hooks/useCopyTrade";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function TraderDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: traderStatus, isLoading: traderLoading } = useMyTraderStatus();
  const { data: followers, isLoading: followersLoading } = useMyFollowers();
  const { data: commissions, isLoading: commissionsLoading } = useMyCommissions();

  // Fetch copied trades for this trader
  const { data: copiedTrades, isLoading: tradesLoading } = useQuery({
    queryKey: ["trader-copied-trades", traderStatus?.id],
    queryFn: async () => {
      if (!traderStatus?.id) return [];

      const { data, error } = await supabase
        .from("copied_trades")
        .select(`
          *,
          subscription:copy_subscriptions!copied_trades_subscription_id_fkey(
            follower_id,
            copy_percentage
          ),
          market:markets(title, status)
        `)
        .eq("subscription.trader_id", traderStatus.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!traderStatus?.id,
  });

  // Calculate stats
  const stats = useMemo(() => {
    const totalFollowers = followers?.length || 0;
    const totalTradesCopied = copiedTrades?.filter(t => t.status === "EXECUTED").length || 0;
    const totalCommissions = commissions?.reduce((sum, c) => sum + (c.trader_share || 0), 0) || 0;
    const pendingCommissions = commissions?.filter(c => !c.trader_ledger_id).reduce((sum, c) => sum + (c.trader_share || 0), 0) || 0;

    return {
      totalFollowers,
      totalTradesCopied,
      totalCommissions,
      pendingCommissions,
    };
  }, [followers, copiedTrades, commissions]);

  // Generate chart data for last 30 days
  const chartData = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Count followers acquired up to this day
      const followersCount = followers?.filter(f => 
        new Date(f.created_at) <= dayEnd
      ).length || 0;

      // Sum commissions for this specific day
      const dayCommissions = commissions?.filter(c => {
        const cDate = new Date(c.created_at);
        return cDate >= dayStart && cDate <= dayEnd;
      }).reduce((sum, c) => sum + (c.trader_share || 0), 0) || 0;

      // Count trades copied on this day
      const dayTrades = copiedTrades?.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate >= dayStart && tDate <= dayEnd && t.status === "EXECUTED";
      }).length || 0;

      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        fullDate: format(day, "dd/MM/yyyy", { locale: ptBR }),
        followers: followersCount,
        commissions: dayCommissions,
        trades: dayTrades,
      };
    });
  }, [followers, commissions, copiedTrades]);

  // Cumulative commissions for area chart
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return chartData.map(day => {
      cumulative += day.commissions;
      return {
        ...day,
        cumulativeCommissions: cumulative,
      };
    });
  }, [chartData]);

  const chartConfig = {
    followers: {
      label: "Seguidores",
      color: "hsl(var(--primary))",
    },
    commissions: {
      label: "Comissões",
      color: "hsl(var(--success))",
    },
    trades: {
      label: "Trades",
      color: "hsl(var(--accent))",
    },
    cumulativeCommissions: {
      label: "Total Acumulado",
      color: "hsl(var(--success))",
    },
  };

  if (authLoading || traderLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!traderStatus || traderStatus.status !== "APPROVED") {
    return <Navigate to="/copy-traders" replace />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXECUTED":
        return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" /> Executado</Badge>;
      case "SKIPPED":
        return <Badge variant="outline" className="border-warning text-warning"><AlertCircle className="h-3 w-3 mr-1" /> Ignorado</Badge>;
      case "FAILED":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      case "PENDING":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard do Trader</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe seus seguidores, trades copiados e comissões.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguidores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFollowers}</div>
            <p className="text-xs text-muted-foreground">
              seguidores ativos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trades Copiados</CardTitle>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTradesCopied}</div>
            <p className="text-xs text-muted-foreground">
              total de cópias
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {stats.totalCommissions.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              ganhos acumulados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              R$ {stats.pendingCommissions.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              aguardando liquidação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="followers">Seguidores</TabsTrigger>
          <TabsTrigger value="trades">Trades Copiados</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {/* Followers Evolution Chart */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Evolução de Seguidores
              </CardTitle>
              <CardDescription>
                Crescimento da sua base de seguidores nos últimos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="followersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="followers"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#followersGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Commissions Chart */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-success" />
                  Comissões Diárias
                </CardTitle>
                <CardDescription>
                  Comissões recebidas por dia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Comissão"]}
                    />
                    <Bar 
                      dataKey="commissions" 
                      fill="hsl(var(--success))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                  Comissões Acumuladas
                </CardTitle>
                <CardDescription>
                  Total acumulado ao longo do tempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="commissionsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Total"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeCommissions"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      fill="url(#commissionsGradient)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Trades Chart */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-accent" />
                Trades Copiados por Dia
              </CardTitle>
              <CardDescription>
                Volume de trades copiados pelos seus seguidores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="trades"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followers" className="space-y-4">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Seus Seguidores</CardTitle>
              <CardDescription>
                Usuários que estão copiando seus trades
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !followers || followers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Você ainda não tem seguidores.</p>
                  <p className="text-sm">Continue fazendo bons trades para atrair seguidores!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seguidor</TableHead>
                      <TableHead>% Cópia</TableHead>
                      <TableHead>Auto-Copy</TableHead>
                      <TableHead>Trades Copiados</TableHead>
                      <TableHead>Desde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {followers.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              Seguidor #{sub.id.slice(0, 6)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{sub.copy_percentage || 100}%</TableCell>
                        <TableCell>
                          {sub.auto_copy ? (
                            <Badge className="bg-success/20 text-success">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Manual</Badge>
                          )}
                        </TableCell>
                        <TableCell>{sub.total_trades_copied}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(sub.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades" className="space-y-4">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Trades Copiados</CardTitle>
              <CardDescription>
                Histórico de trades copiados pelos seus seguidores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tradesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !copiedTrades || copiedTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum trade foi copiado ainda.</p>
                  <p className="text-sm">Seus trades serão copiados automaticamente quando você tiver seguidores.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mercado</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead>Valor Original</TableHead>
                      <TableHead>Valor Copiado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {copiedTrades.map((trade: any) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {trade.market?.title || "Mercado"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.outcome === "YES" ? "default" : "secondary"}>
                            {trade.outcome === "YES" ? (
                              <><ArrowUpRight className="h-3 w-3 mr-1" /> SIM</>
                            ) : (
                              <><ArrowDownRight className="h-3 w-3 mr-1" /> NÃO</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>R$ {trade.original_amount?.toFixed(2)}</TableCell>
                        <TableCell>R$ {trade.copied_amount?.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(trade.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(trade.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle>Comissões Recebidas</CardTitle>
              <CardDescription>
                Suas comissões sobre lucros dos seguidores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !commissions || commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma comissão recebida ainda.</p>
                  <p className="text-sm">Você receberá comissões quando seus seguidores tiverem lucro.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lucro do Seguidor</TableHead>
                      <TableHead>% Comissão</TableHead>
                      <TableHead>Sua Parte</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="text-success">
                          + R$ {commission.profit_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{commission.profit_share_percent}%</TableCell>
                        <TableCell className="font-medium text-success">
                          R$ {commission.trader_share.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {commission.trader_ledger_id ? (
                            <Badge className="bg-success/20 text-success">Pago</Badge>
                          ) : (
                            <Badge variant="outline" className="border-warning text-warning">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TraderDashboardPage;
