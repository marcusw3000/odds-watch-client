import { useState } from 'react';
import { Share2, Twitter, Facebook, Link2, Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ShareButtonProps {
  title: string;
  description?: string;
  url?: string;
  marketId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  showLabel?: boolean;
}

export function ShareButton({
  title,
  description,
  url,
  marketId,
  variant = 'outline',
  size = 'sm',
  showLabel = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (marketId ? `${window.location.origin}/market/${marketId}` : window.location.href);
  const shareText = description || title;

  const handleCopyLink = async () => {
    try {
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
    const text = encodeURIComponent(`${title}\n\n${shareText}`);
    const urlParam = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${urlParam}`, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const urlParam = encodeURIComponent(shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${urlParam}`, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${title}\n\n${shareText}\n\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    const text = encodeURIComponent(`${title}\n${shareText}`);
    const urlParam = encodeURIComponent(shareUrl);
    window.open(`https://t.me/share/url?url=${urlParam}&text=${text}`, '_blank', 'noopener,noreferrer');
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
