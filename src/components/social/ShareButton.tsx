import { useState } from 'react';
import { Share2, Facebook, Link2, Copy, Check, MessageCircle, Mail, Instagram, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { generateMarketShareLink, generateSocialShareLinks } from '@/lib/deepLinks';

// Custom X (Twitter) icon
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ShareButtonProps {
  title: string;
  description?: string;
  url?: string;
  marketId?: string;
  outcome?: 'YES' | 'NO';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
}

export function ShareButton({
  title,
  description,
  url,
  marketId,
  outcome,
  variant = 'outline',
  size = 'sm',
  showLabel = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  // Generate deep link with tracking
  const getShareUrl = (source: 'twitter' | 'facebook' | 'whatsapp' | 'telegram' | 'instagram' | 'copy') => {
    if (url) return url;
    if (marketId) {
      return generateMarketShareLink(marketId, { outcome, source: source === 'instagram' ? 'copy' : source });
    }
    return window.location.href;
  };

  const shareText = description || title;

  const handleCopyLink = async () => {
    try {
      const shareUrl = getShareUrl('copy');
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        const shareUrl = getShareUrl('copy');
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleXShare = () => {
    const shareUrl = getShareUrl('twitter');
    const links = generateSocialShareLinks({
      title,
      description: shareText,
      deepLink: shareUrl,
      hashtags: ['MercadoPrevisoes', 'Trading'],
    });
    window.open(links.twitter, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const shareUrl = getShareUrl('facebook');
    const links = generateSocialShareLinks({
      title,
      description: shareText,
      deepLink: shareUrl,
    });
    window.open(links.facebook, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppShare = () => {
    const shareUrl = getShareUrl('whatsapp');
    const links = generateSocialShareLinks({
      title,
      description: shareText,
      deepLink: shareUrl,
    });
    window.open(links.whatsapp, '_blank', 'noopener,noreferrer');
  };

  const handleInstagramShare = () => {
    // Instagram doesn't have a direct share API, copy link instead
    const shareUrl = getShareUrl('instagram');
    navigator.clipboard.writeText(`${title}\n\n${shareText}\n\n${shareUrl}`);
    toast.success('Texto copiado! Cole no Instagram Stories ou Direct.');
  };

  const handleTelegramShare = () => {
    const shareUrl = getShareUrl('telegram');
    const links = generateSocialShareLinks({
      title,
      description: shareText,
      deepLink: shareUrl,
    });
    window.open(links.telegram, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    const shareUrl = getShareUrl('copy');
    const links = generateSocialShareLinks({
      title,
      description: shareText,
      deepLink: shareUrl,
    });
    window.location.href = links.email;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className="h-4 w-4" />
          {showLabel && <span className="ml-2">Compartilhar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {navigator.share && (
          <>
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={handleWhatsAppShare} className="text-green-600">
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleInstagramShare} className="text-pink-600">
          <Instagram className="mr-2 h-4 w-4" />
          Instagram
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleXShare}>
          <XIcon className="mr-2 h-4 w-4" />
          X
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleFacebookShare} className="text-blue-600">
          <Facebook className="mr-2 h-4 w-4" />
          Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleTelegramShare} className="text-sky-500">
          <Send className="mr-2 h-4 w-4" />
          Telegram
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleEmailShare}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              Copiado!
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Copiar link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
