import { useState } from 'react';
import { UserPlus, Copy, Check, Twitter, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { generateTradeInviteLink, generateSocialShareLinks } from '@/lib/deepLinks';
import { cn } from '@/lib/utils';

interface InviteToTradeProps {
  marketId: string;
  marketTitle: string;
  yesPrice: number;
  noPrice: number;
  trigger?: React.ReactNode;
}

export function InviteToTrade({
  marketId,
  marketTitle,
  yesPrice,
  noPrice,
  trigger,
}: InviteToTradeProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO'>('YES');
  const [copied, setCopied] = useState(false);

  const inviteLink = generateTradeInviteLink(marketId, selectedOutcome, 'invite');
  
  const inviteText = selectedOutcome === 'YES'
    ? `🎯 Acho que SIM! Venha operar comigo: "${marketTitle}" @ ${yesPrice}%`
    : `🎯 Acho que NÃO! Venha operar comigo: "${marketTitle}" @ ${noPrice}%`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${inviteText}\n\n${inviteLink}`);
      setCopied(true);
      toast.success('Link de convite copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleTwitterShare = () => {
    const links = generateSocialShareLinks({
      title: inviteText,
      deepLink: inviteLink,
      hashtags: ['Trading', 'MercadoPrevisoes'],
    });
    window.open(links.twitter, '_blank');
  };

  const handleWhatsAppShare = () => {
    const links = generateSocialShareLinks({
      title: inviteText,
      deepLink: inviteLink,
    });
    window.open(links.whatsapp, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para Trade</DialogTitle>
          <DialogDescription>
            Convide amigos para operar neste mercado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Market Preview */}
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium line-clamp-2">{marketTitle}</p>
          </div>

          {/* Outcome Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Sua posição:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedOutcome('YES')}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-center",
                  selectedOutcome === 'YES'
                    ? "border-green-500 bg-green-500/10"
                    : "border-border hover:border-green-500/50"
                )}
              >
                <span className="text-2xl font-bold text-green-500">SIM</span>
                <p className="text-sm text-muted-foreground mt-1">{yesPrice}%</p>
              </button>
              <button
                onClick={() => setSelectedOutcome('NO')}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-center",
                  selectedOutcome === 'NO'
                    ? "border-red-500 bg-red-500/10"
                    : "border-border hover:border-red-500/50"
                )}
              >
                <span className="text-2xl font-bold text-red-500">NÃO</span>
                <p className="text-sm text-muted-foreground mt-1">{noPrice}%</p>
              </button>
            </div>
          </div>

          {/* Preview Message */}
          <div className="p-3 rounded-lg bg-muted text-sm">
            <p className="text-muted-foreground">{inviteText}</p>
          </div>

          {/* Share Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleCopy} variant="outline" className="w-full">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button onClick={handleTwitterShare} variant="outline" className="w-full">
              <Twitter className="h-4 w-4" />
            </Button>
            <Button onClick={handleWhatsAppShare} variant="outline" className="w-full">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
