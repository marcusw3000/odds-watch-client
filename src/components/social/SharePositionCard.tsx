import { useState } from 'react';
import { Share2, Download, Twitter, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Position {
  eventTitle: string;
  outcome: 'YES' | 'NO';
  quantity: number;
  priceAtPurchase: number;
  currentPrice: number;
  profitPercent: number;
}

interface SharePositionCardProps {
  position: Position;
  trigger?: React.ReactNode;
}

export function SharePositionCard({ position, trigger }: SharePositionCardProps) {
  const [copied, setCopied] = useState(false);
  const isProfit = position.profitPercent >= 0;

  const shareText = `📊 Minha posição: ${position.eventTitle}\n\n${position.outcome === 'YES' ? '✅' : '❌'} ${position.outcome} × ${position.quantity} contratos\n💰 ${isProfit ? '+' : ''}${position.profitPercent.toFixed(1)}% ${isProfit ? '📈' : '📉'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${window.location.origin}/markets`);
      setCopied(true);
      toast.success('Copiado para área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(shareText);
    const url = encodeURIComponent(window.location.origin + '/markets');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Posição</DialogTitle>
        </DialogHeader>

        {/* Preview Card */}
        <Card className="bg-gradient-to-br from-background to-muted border-2">
          <CardContent className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Minha Posição</span>
              <Badge variant={position.outcome === 'YES' ? 'default' : 'destructive'}>
                {position.outcome}
              </Badge>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-lg leading-tight line-clamp-2">
              {position.eventTitle}
            </h3>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Contratos</p>
                <p className="font-bold text-xl">{position.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço médio</p>
                <p className="font-mono font-medium">
                  R$ {(position.priceAtPurchase / 100).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Profit/Loss */}
            <div className={cn(
              "p-3 rounded-lg text-center",
              isProfit ? "bg-green-500/10" : "bg-red-500/10"
            )}>
              <p className="text-xs text-muted-foreground mb-1">Retorno</p>
              <p className={cn(
                "text-2xl font-bold",
                isProfit ? "text-green-500" : "text-red-500"
              )}>
                {isProfit ? '+' : ''}{position.profitPercent.toFixed(1)}%
              </p>
            </div>

            {/* Branding */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/50">
              <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">M</span>
              </div>
              <span className="text-xs text-muted-foreground">Mercado de Previsões</span>
            </div>
          </CardContent>
        </Card>

        {/* Share Actions */}
        <div className="flex gap-2">
          <Button onClick={handleTwitterShare} className="flex-1" variant="outline">
            <Twitter className="h-4 w-4 mr-2" />
            Twitter
          </Button>
          <Button onClick={handleCopy} className="flex-1" variant="outline">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
