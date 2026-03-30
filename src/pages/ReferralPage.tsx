import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, Users, Gift, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ReferralService } from '@/services/ReferralService';
import { formatCurrency } from '@/lib/formatters';
import type { ReferralStats, Referral } from '@/types/referral';

export function ReferralPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [statsData, referralsData, code] = await Promise.all([
        ReferralService.getReferralStats(user.id),
        ReferralService.getMyReferrals(user.id),
        ReferralService.getMyReferralCode(user.id)
      ]);
      
      setStats(statsData);
      setReferrals(referralsData);
      setReferralCode(code);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleGenerateCode = async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      const { code, error } = await ReferralService.generateReferralCode(user.id);
      
      if (error) {
        toast({
          title: 'Erro',
          description: error,
          variant: 'destructive'
        });
        return;
      }
      
      setReferralCode(code);
      toast({
        title: 'Código gerado!',
        description: `Seu código de indicação é: ${code}`
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao gerar código de indicação',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (!referralCode) return;
    
    navigator.clipboard.writeText(referralCode);
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência'
    });
  };

  const handleCopyLink = () => {
    if (!referralCode) return;
    
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link copiado!',
      description: 'Link de indicação copiado para a área de transferência'
    });
  };

  const handleShare = async () => {
    if (!referralCode) return;
    
    const link = `${window.location.origin}/auth?ref=${referralCode}`;
    const text = `Use meu código de indicação ${referralCode} e ganhe desconto nas taxas!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Código de Indicação',
          text,
          url: link
        });
      } catch (error) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  // formatCurrency is now imported from @/lib/formatters

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVATED':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-muted text-muted-foreground">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Programa de Indicação</h1>
        <p className="text-muted-foreground">
          Indique amigos e ganhe comissões em cada operação que eles realizarem!
        </p>
      </div>

      {/* Referral Code Card */}
      <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Seu Código de Indicação
          </CardTitle>
          <CardDescription>
            Compartilhe este código com seus amigos. Eles ganham desconto nas taxas e você ganha comissão!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralCode ? (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="bg-background/80 backdrop-blur rounded-lg px-6 py-4 border-2 border-primary/30">
                <span className="text-2xl font-mono font-bold tracking-wider text-primary">
                  {referralCode}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Código
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerateCode} disabled={generating}>
              {generating ? 'Gerando...' : 'Gerar Meu Código'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Indicados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalReferrals ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              pessoas indicadas por você
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicações Ativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.activatedReferrals ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              fizeram depósito mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.pendingReferrals ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              aguardando ativação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Ganhas</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats?.totalCommissionEarned ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              total acumulado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Indicados</CardTitle>
          <CardDescription>
            Lista de pessoas que você indicou para a plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Você ainda não indicou ninguém.</p>
              <p className="text-sm">Compartilhe seu código e comece a ganhar comissões!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ativação</TableHead>
                  <TableHead className="text-right">Comissão Ganha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>{formatDate(referral.created_at)}</TableCell>
                    <TableCell>{getStatusBadge(referral.status)}</TableCell>
                    <TableCell>
                      {referral.activated_at 
                        ? formatDate(referral.activated_at) 
                        : <span className="text-muted-foreground">-</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(referral.total_commission_earned)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Como Funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Compartilhe seu código</h4>
                <p className="text-sm text-muted-foreground">
                  Envie seu código de indicação para amigos e familiares
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">Eles se cadastram</h4>
                <p className="text-sm text-muted-foreground">
                  Ao usar seu código, eles ganham desconto nas taxas por 30 dias
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">Você ganha comissão</h4>
                <p className="text-sm text-muted-foreground">
                  A cada operação que eles fizerem, você recebe 10% da taxa
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
