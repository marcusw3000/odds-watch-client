import { CopySubscription } from "@/types/copyTrade";
import { useCancelCopySubscription } from "@/hooks/useCopyTrade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Settings, X, Zap, ZapOff, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface SubscriptionCardProps {
  subscription: CopySubscription;
  onEdit: (subscription: CopySubscription) => void;
}

export function SubscriptionCard({ subscription, onEdit }: SubscriptionCardProps) {
  const cancelMutation = useCancelCopySubscription();
  const trader = subscription.trader;
  
  const handleCancel = () => {
    cancelMutation.mutate(subscription.id);
  };
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Trader Info */}
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={trader?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {trader?.display_name?.charAt(0).toUpperCase() || "T"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {trader?.display_name || "Trader"}
              </p>
              <Badge 
                variant={subscription.auto_copy ? "default" : "destructive"}
                className="mt-1 text-xs"
              >
                {subscription.auto_copy ? (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Copy Ativo
                  </>
                ) : (
                  <>
                    <ZapOff className="h-3 w-3 mr-1" />
                    Pausado
                  </>
                )}
              </Badge>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onEdit(subscription)}
              title="Configurações"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  title="Cancelar assinatura"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar Assinatura</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura com {trader?.display_name}? 
                    Você não receberá mais trades copiados deste trader.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancelar Assinatura
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Máx/Trade</p>
            <p className="text-sm font-medium text-foreground">
              {formatCurrency(subscription.max_trade_amount || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">% Copy</p>
            <p className="text-sm font-medium text-foreground">
              {subscription.copy_percentage || 100}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Copiados</p>
            <p className="text-sm font-medium text-foreground">
              {subscription.total_trades_copied}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
