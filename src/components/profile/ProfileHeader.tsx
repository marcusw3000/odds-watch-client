import { useState } from 'react';
import { Calendar, Edit2, Trophy, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AvatarUpload } from './AvatarUpload';
import type { UserProfile } from '@/types/leaderboard';

interface ProfileHeaderProps {
  profile: UserProfile;
  rank?: number;
  isOwnProfile: boolean;
  onUpdate?: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfileHeader({
  profile,
  rank,
  isOwnProfile,
  onUpdate,
}: ProfileHeaderProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile.display_name || '');
  const [editedBio, setEditedBio] = useState(profile.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;
    
    setIsSaving(true);
    try {
      await onUpdate({
        display_name: editedName || null,
        bio: editedBio || null,
      });
      setIsEditing(false);
      // Invalidar cache de display info para atualizar comentários imediatamente
      queryClient.invalidateQueries({ queryKey: ['user-display-info'] });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(profile.display_name || '');
    setEditedBio(profile.bio || '');
    setIsEditing(false);
  };

  const handleAvatarChange = (newUrl: string) => {
    // Invalidate queries to refresh profile data with new avatar
    queryClient.invalidateQueries({ queryKey: ['my-leaderboard-profile'] });
    queryClient.invalidateQueries({ queryKey: ['public-profile'] });
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', label: '1º Lugar', variant: 'default' as const };
    if (rank === 2) return { emoji: '🥈', label: '2º Lugar', variant: 'secondary' as const };
    if (rank === 3) return { emoji: '🥉', label: '3º Lugar', variant: 'secondary' as const };
    if (rank <= 10) return { emoji: '🏆', label: `Top 10`, variant: 'outline' as const };
    if (rank <= 50) return { emoji: '⭐', label: `Top 50`, variant: 'outline' as const };
    return null;
  };

  const rankInfo = rank ? getRankBadge(rank) : null;
  const memberSince = profile.created_at 
    ? format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR })
    : null;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <AvatarUpload
            currentAvatarUrl={profile.avatar_url}
            displayName={profile.display_name}
            onAvatarChange={handleAvatarChange}
            size="xl"
            editable={isOwnProfile}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Nome de exibição
                </label>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Seu nome no leaderboard"
                  className="mt-1"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Bio
                </label>
                <Textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="mt-1 resize-none"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editedBio.length}/200 caracteres
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold truncate">
                    {profile.display_name || 'Trader Anônimo'}
                  </h1>
                  {profile.bio && (
                    <p className="text-muted-foreground mt-1 line-clamp-2">
                      {profile.bio}
                    </p>
                  )}
                </div>
                {isOwnProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                {rankInfo && (
                  <Badge variant={rankInfo.variant} className="gap-1">
                    <span>{rankInfo.emoji}</span>
                    <span>{rankInfo.label}</span>
                  </Badge>
                )}
                {rank && !rankInfo && (
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    <span>#{rank} no ranking</span>
                  </Badge>
                )}
                {memberSince && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Membro desde {memberSince}
                  </span>
                )}
                {!profile.is_public && !isOwnProfile && (
                  <Badge variant="secondary">Perfil Privado</Badge>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
