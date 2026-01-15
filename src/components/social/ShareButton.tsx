import { useState } from 'react';
import { Share2, Twitter, Facebook, Link2, Copy, Check, MessageCircle, Mail } from 'lucide-react';
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
  const getShareUrl = (source: 'twitter' | 'facebook' | 'whatsapp' | 'telegram' | 'copy') => {
    if (url) return url;
    if (marketId) {
      return generateMarketShareLink(marketId, { outcome, source });
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

  const handleTwitterShare = () => {
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
        
        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="mr-2 h-4 w-4" />
          Twitter / X
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleFacebookShare}>
          <Facebook className="mr-2 h-4 w-4" />
          Facebook
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleWhatsAppShare}>
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleTelegramShare}>
          <MessageCircle className="mr-2 h-4 w-4" />
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
