import { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, Instagram, TrendingUp, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

// Custom X (Twitter) icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function SharePositionCard({ position, trigger }: SharePositionCardProps) {
  const [copied, setCopied] = useState(false);
  const isProfit = position.profitPercent >= 0;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/markets`
      : '/markets';
  const shareText = `📊 Minha posição: ${position.eventTitle}\n\n${position.outcome === 'YES' ? '✅' : '❌'} ${position.outcome} × ${position.quantity} contratos\n💰 ${isProfit ? '+' : ''}${position.profitPercent.toFixed(2)}% ${isProfit ? '📈' : '📉'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      toast.success('Copiado para área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleXShare = () => {
    const text = encodeURIComponent(shareText);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleInstagramShare = () => {
    // Instagram doesn't have a direct share URL, so we copy and inform user
    handleCopy();
    toast.info('Texto copiado! Cole no Instagram Stories ou Direct.');
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
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Posição
          </DialogTitle>
        </DialogHeader>

        {/* Preview Card - Improved Layout */}
        <div className="p-6 pt-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-primary to-transparent rounded-full blur-2xl" />
            </div>

            {/* Content */}
            <div className="relative z-10 space-y-5">
              {/* Header with outcome badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Minha Posição
                </span>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  position.outcome === 'YES' 
                    ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                )}>
                  {position.outcome === 'YES' ? '✓ SIM' : '✗ NÃO'}
                </div>
              </div>

              {/* Title */}
              <h3 className="font-bold text-xl leading-snug line-clamp-2">
                {position.eventTitle}
              </h3>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Contratos</p>
                  <p className="font-bold text-2xl">{position.quantity}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Preço</p>
                  <p className="font-mono font-semibold text-lg">
                    {position.priceAtPurchase}¢
                  </p>
                </div>
                <div className={cn(
                  "rounded-xl p-3 flex flex-col items-center justify-center",
                  isProfit ? "bg-green-500/20" : "bg-red-500/20"
                )}>
                  <div className="flex items-center gap-1">
                    {isProfit ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <span className={cn(
                      "font-bold text-xl",
                      isProfit ? "text-green-400" : "text-red-400"
                    )}>
                      {isProfit ? '+' : ''}{position.profitPercent.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Retorno</p>
                </div>
              </div>

              {/* Branding Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-primary-foreground">M</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Mercado de Previsões</p>
                    <p className="text-[10px] text-slate-400">mercadoprevisoes.com.br</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Negocie previsões</p>
                  <p className="text-[10px] text-slate-400">sobre economia</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Share Actions */}
        <div className="p-6 pt-0 space-y-3">
          <p className="text-sm text-muted-foreground text-center">Compartilhar via</p>
          <div className="grid grid-cols-4 gap-2">
            <Button 
              onClick={handleWhatsAppShare} 
              variant="outline" 
              className="flex-col h-auto py-3 gap-1 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-600"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-[10px]">WhatsApp</span>
            </Button>
            <Button 
              onClick={handleInstagramShare} 
              variant="outline" 
              className="flex-col h-auto py-3 gap-1 hover:bg-pink-500/10 hover:border-pink-500/50 hover:text-pink-600"
            >
              <Instagram className="h-5 w-5" />
              <span className="text-[10px]">Instagram</span>
            </Button>
            <Button 
              onClick={handleXShare} 
              variant="outline" 
              className="flex-col h-auto py-3 gap-1 hover:bg-foreground/10 hover:border-foreground/50"
            >
              <XIcon className="h-5 w-5" />
              <span className="text-[10px]">X</span>
            </Button>
            <Button 
              onClick={handleCopy} 
              variant="outline" 
              className="flex-col h-auto py-3 gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-[10px] text-green-500">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  <span className="text-[10px]">Copiar</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
