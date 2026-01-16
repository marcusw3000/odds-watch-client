import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  displayName: string | null;
  onAvatarChange: (newUrl: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
  xl: 'h-32 w-32',
};

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
};

export function AvatarUpload({
  currentAvatarUrl,
  displayName,
  onAvatarChange,
  size = 'lg',
  editable = true,
}: AvatarUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido', {
        description: 'Use JPG, PNG ou WebP.',
      });
      return;
    }

    // Validate file size (2MB max)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande', {
        description: 'O tamanho máximo é 2MB.',
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarChange(publicUrl);
      toast.success('Avatar atualizado!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao fazer upload', {
        description: 'Tente novamente.',
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (editable && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || currentAvatarUrl;

  return (
    <div className="relative inline-block">
      <Avatar
        className={`${sizeClasses[size]} ${editable ? 'cursor-pointer' : ''} ring-2 ring-background shadow-lg`}
        onClick={handleClick}
      >
        <AvatarImage src={displayUrl || undefined} alt={displayName || 'Avatar'} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <button
          onClick={handleClick}
          disabled={isUploading}
          className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className={`${iconSizeClasses[size]} animate-spin`} />
          ) : (
            <Camera className={iconSizeClasses[size]} />
          )}
        </button>
      )}

      {previewUrl && !isUploading && (
        <Button
          size="icon"
          variant="destructive"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
          onClick={(e) => {
            e.stopPropagation();
            clearPreview();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
