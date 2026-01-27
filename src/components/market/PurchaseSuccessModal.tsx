import { useState, useRef, useEffect } from 'react';
import { X, Check, Copy, Download, PartyPopper, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confetti } from '@/components/ui/confetti';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { generateMarketShareLink, generateSocialShareLinks } from '@/lib/deepLinks';
import { haptics } from '@/lib/haptics';

// Custom X icon
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Instagram icon
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

// WhatsApp icon
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

interface PurchaseSuccessModalProps {
  eventTitle: string;
  eventId: string;
  outcome: 'YES' | 'NO';
  optionLabel?: string; // For multi-option markets
  shares: number;
  totalCost: number;
  potentialProfit: number;
  onClose: () => void;
}

export function PurchaseSuccessModal({
  eventTitle,
  eventId,
  outcome,
  optionLabel,
  shares,
  totalCost,
  potentialProfit,
  onClose,
}: PurchaseSuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  // Trigger haptic feedback on mount
  useEffect(() => {
    haptics.success();
  }, []);

  const shareLink = generateMarketShareLink(eventId, { outcome, source: 'copy' });
  const socialLinks = generateSocialShareLinks({
    title: `Comprei contratos de ${outcome === 'YES' ? 'SIM' : 'NÃO'} em "${eventTitle}" 🎯`,
    description: `${shares} contratos por R$${totalCost.toFixed(2)}. Lucro potencial: R$${potentialProfit.toFixed(2)}!`,
    deepLink: shareLink,
    hashtags: ['trading', 'previsões', 'mercado'],
  });

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    
    setIsDownloading(true);
    try {
      // Dynamically import html2canvas to reduce initial bundle size
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2, // Higher resolution
        logging: false,
        useCORS: true,
      });
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `posicao-${outcome.toLowerCase()}-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success('Imagem baixada com sucesso!');
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar imagem');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleXShare = () => {
    window.open(socialLinks.twitter, '_blank', 'width=550,height=450');
  };

  const handleWhatsAppShare = () => {
    window.open(socialLinks.whatsapp, '_blank');
  };

  const handleInstagramShare = async () => {
    await navigator.clipboard.writeText(
      `🎯 Comprei contratos de ${outcome === 'YES' ? 'SIM' : 'NÃO'} em "${eventTitle}"\n\n` +
      `📊 ${shares} contratos por R$${totalCost.toFixed(2)}\n` +
      `💰 Lucro potencial: R$${potentialProfit.toFixed(2)}\n\n` +
      `🔗 ${shareLink}`
    );
    toast.success('Texto copiado! Cole no Instagram Stories ou Direct');
  };

  const isMultiOption = !!optionLabel;
  const isYes = outcome === 'YES';

  return (
    <>
      {/* Real confetti animation */}
      {showConfetti && (
        <Confetti 
          count={60} 
          duration={3500} 
          onComplete={() => setShowConfetti(false)} 
        />
      )}
      
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-success-title"
      >
        <div 
          className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-elevated animate-scale-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Success Header */}
          <div className={cn(
            "relative p-6 text-center",
            isYes 
              ? "bg-gradient-to-br from-yes/20 via-yes/10 to-transparent" 
              : "bg-gradient-to-br from-no/20 via-no/10 to-transparent"
          )}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
            className="absolute top-3 right-3"
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className={cn(
            "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-scale-in",
            isYes ? "bg-yes/20" : "bg-no/20"
          )}>
            <PartyPopper className={cn(
              "h-8 w-8",
              isYes ? "text-yes" : "text-no"
            )} />
          </div>
          
          <h2 id="purchase-success-title" className="text-xl font-bold mb-1">Compra Confirmada! 🎉</h2>
          <p className="text-sm text-muted-foreground">
            Sua posição foi registrada com sucesso
          </p>
        </div>

        {/* Trade Details Card - Shareable Preview */}
        <div className="p-5">
          <div 
            ref={cardRef}
            className="rounded-xl overflow-hidden border border-slate-700 shadow-lg"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white relative">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{ 
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '20px 20px'
                }} />
              </div>
              
              <div className="relative">
                <p className="text-xs text-slate-400 mb-2">Minha Aposta</p>
                <p className="font-medium text-sm leading-snug mb-3 line-clamp-2">
                  {eventTitle}
                </p>
                
                {/* Outcome Badge */}
                <div className="flex items-center gap-3">
                  {isMultiOption ? (
                    <span className="px-4 py-2 rounded-lg font-bold text-lg bg-primary/20 text-primary border border-primary/30">
                      {optionLabel}
                    </span>
                  ) : (
                    <span className={cn(
                      "px-4 py-2 rounded-lg font-bold text-lg",
                      isYes 
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    )}>
                      {isYes ? 'SIM' : 'NÃO'}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Contratos</p>
                    <p className="font-bold text-lg">{shares}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Card Stats */}
            <div className="bg-slate-800 grid grid-cols-2 divide-x divide-slate-700">
              <div className="p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Investido</p>
                <p className="font-bold text-white">R${totalCost.toFixed(2)}</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Lucro Potencial</p>
                <p className="font-bold text-emerald-400">+R${potentialProfit.toFixed(2)}</p>
              </div>
            </div>
            
            {/* Branding */}
            <div className="bg-slate-900 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium tracking-wider">
                PREDIX.COM.BR
              </span>
              <span className="text-[10px] text-slate-500">
                {new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Share Actions */}
        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm font-medium text-center text-muted-foreground">
            Compartilhe sua aposta
          </p>
          
          <div className="grid grid-cols-5 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
              disabled={isDownloading}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-primary hover:text-primary-foreground"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="text-[10px]">Baixar</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              <span className="text-[10px]">Copiar</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleXShare}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-black hover:text-white"
            >
              <XIcon />
              <span className="text-[10px]">X</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsAppShare}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#25D366] hover:text-white"
            >
              <WhatsAppIcon />
              <span className="text-[10px]">WhatsApp</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstagramShare}
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-gradient-to-br hover:from-purple-600 hover:via-pink-500 hover:to-orange-400 hover:text-white"
            >
              <InstagramIcon />
              <span className="text-[10px]">Instagram</span>
            </Button>
          </div>
          
          <Button 
            variant="default" 
            className="w-full"
            onClick={onClose}
          >
            <Check className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
