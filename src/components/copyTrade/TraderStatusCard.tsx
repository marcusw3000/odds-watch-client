import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Ban, 
  UserPlus, 
  ExternalLink,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyTrader } from "@/types/copyTrade";
import { ApplyTraderModal } from "./ApplyTraderModal";

interface TraderStatusCardProps {
  traderStatus: CopyTrader | null;
  isLoading: boolean;
}

export function TraderStatusCard({ traderStatus, isLoading }: TraderStatusCardProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);

  if (isLoading) {
    return (
      <Card className="mb-8 bg-gradient-card border-border/50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User has not applied yet
  if (!traderStatus) {
    return (
      <>
        <Card className="mb-8 bg-gradient-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Quer ser um Copy Trader?
            </CardTitle>
            <CardDescription>
              Compartilhe suas estratégias e ganhe comissões quando outros seguirem seus trades.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button onClick={() => setShowApplyModal(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Candidatar-se como Trader
            </Button>
          </CardContent>
        </Card>

        <ApplyTraderModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
        />
      </>
    );
  }

  // Render based on status
  const statusConfig = {
    PENDING: {
      icon: Clock,
      iconColor: "text-warning",
      badgeVariant: "outline" as const,
      badgeClass: "border-warning text-warning",
      title: "Candidatura em Análise",
      description: "Sua candidatura está sendo analisada pela nossa equipe. Você receberá uma notificação assim que houver uma atualização.",
    },
    APPROVED: {
      icon: CheckCircle,
      iconColor: "text-success",
      badgeVariant: "outline" as const,
      badgeClass: "border-success text-success",
      title: "Trader Aprovado",
      description: "Parabéns! Você é um Copy Trader aprovado. Seus seguidores podem copiar seus trades.",
    },
    REJECTED: {
      icon: XCircle,
      iconColor: "text-destructive",
      badgeVariant: "outline" as const,
      badgeClass: "border-destructive text-destructive",
      title: "Candidatura Recusada",
      description: traderStatus.rejection_reason || "Sua candidatura não foi aprovada. Você pode tentar novamente.",
    },
    SUSPENDED: {
      icon: Ban,
      iconColor: "text-muted-foreground",
      badgeVariant: "outline" as const,
      badgeClass: "border-muted-foreground text-muted-foreground",
      title: "Conta Suspensa",
      description: "Sua conta de trader foi suspensa. Entre em contato com o suporte para mais informações.",
    },
  };

  const config = statusConfig[traderStatus.status];
  const Icon = config.icon;

  return (
    <>
      <Card className="mb-8 bg-gradient-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
              {config.title}
            </CardTitle>
            <Badge variant={config.badgeVariant} className={config.badgeClass}>
              {traderStatus.status === 'PENDING' && 'Aguardando'}
              {traderStatus.status === 'APPROVED' && 'Aprovado'}
              {traderStatus.status === 'REJECTED' && 'Recusado'}
              {traderStatus.status === 'SUSPENDED' && 'Suspenso'}
            </Badge>
          </div>
          <CardDescription className="mt-2">
            {config.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-0">
          {traderStatus.status === 'APPROVED' && (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">{traderStatus.total_followers}</strong> seguidores
                </span>
                <span>
                  <strong className="text-foreground">{traderStatus.total_trades_copied}</strong> trades copiados
                </span>
              </div>
            </div>
          )}

          {traderStatus.status === 'REJECTED' && (
            <div className="space-y-3">
              {traderStatus.rejection_reason && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-destructive">{traderStatus.rejection_reason}</span>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={() => setShowApplyModal(true)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          )}

          {traderStatus.status === 'SUSPENDED' && (
            <Button variant="outline" asChild>
              <Link to="/settings?tab=support">
                <ExternalLink className="mr-2 h-4 w-4" />
                Contatar Suporte
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <ApplyTraderModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
      />
    </>
  );
}
