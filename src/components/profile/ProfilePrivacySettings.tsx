import { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, Save, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { UserProfile } from '@/types/leaderboard';

interface ProfilePrivacySettingsProps {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfilePrivacySettings({ profile, onUpdate }: ProfilePrivacySettingsProps) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [showProfit, setShowProfit] = useState(profile.show_profit);
  const [showROI, setShowROI] = useState(profile.show_roi);
  const [showVolume, setShowVolume] = useState(profile.show_volume);
  const [showTrades, setShowTrades] = useState(profile.show_trades);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when profile changes
  useEffect(() => {
    setDisplayName(profile.display_name || '');
    setBio(profile.bio || '');
    setIsPublic(profile.is_public);
    setShowProfit(profile.show_profit);
    setShowROI(profile.show_roi);
    setShowVolume(profile.show_volume);
    setShowTrades(profile.show_trades);
  }, [profile]);

  const hasChanges = 
    displayName !== (profile.display_name || '') ||
    bio !== (profile.bio || '') ||
    isPublic !== profile.is_public ||
    showProfit !== profile.show_profit ||
    showROI !== profile.show_roi ||
    showVolume !== profile.show_volume ||
    showTrades !== profile.show_trades;

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('Nome de exibição é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        is_public: isPublic,
        show_profit: showProfit,
        show_roi: showROI,
        show_volume: showVolume,
        show_trades: showTrades,
      });
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      toast.error('Erro ao salvar', {
        description: 'Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDisplayName(profile.display_name || '');
    setBio(profile.bio || '');
    setIsPublic(profile.is_public);
    setShowProfit(profile.show_profit);
    setShowROI(profile.show_roi);
    setShowVolume(profile.show_volume);
    setShowTrades(profile.show_trades);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Configurações do Perfil
        </CardTitle>
        <CardDescription>
          Configure como você aparece no ranking e controle o que outros usuários podem ver
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            Informações do Perfil
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome de Exibição *</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu apelido no ranking"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              Este nome será exibido publicamente no leaderboard e no seu perfil.
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio (opcional)</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Uma breve descrição sobre você..."
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/200
            </p>
          </div>
        </div>

        <Separator />

        {/* Public Profile Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3">
            {isPublic ? (
              <Eye className="h-5 w-5 text-green-500" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="public-profile" className="text-base font-medium cursor-pointer">
                Participar do Leaderboard
              </Label>
              <p className="text-sm text-muted-foreground">
                {isPublic 
                  ? 'Seu perfil está visível publicamente'
                  : 'Seu perfil está oculto do ranking'}
              </p>
            </div>
          </div>
          <Switch
            id="public-profile"
            checked={isPublic}
            onCheckedChange={(checked) => {
              if (checked && !displayName.trim()) {
                toast.error('Nome de exibição obrigatório', {
                  description: 'Você precisa definir um nome de exibição antes de tornar seu perfil público.',
                });
                return;
              }
              setIsPublic(checked);
            }}
          />
        </div>

        {/* Individual Metric Toggles */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Métricas visíveis no leaderboard e perfil público:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show-profit" className="flex items-center gap-2 cursor-pointer">
                {showProfit ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Lucro Total
              </Label>
              <Switch
                id="show-profit"
                checked={showProfit}
                onCheckedChange={setShowProfit}
                disabled={!isPublic}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show-roi" className="flex items-center gap-2 cursor-pointer">
                {showROI ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                ROI (%)
              </Label>
              <Switch
                id="show-roi"
                checked={showROI}
                onCheckedChange={setShowROI}
                disabled={!isPublic}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show-volume" className="flex items-center gap-2 cursor-pointer">
                {showVolume ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Volume Total
              </Label>
              <Switch
                id="show-volume"
                checked={showVolume}
                onCheckedChange={setShowVolume}
                disabled={!isPublic}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show-trades" className="flex items-center gap-2 cursor-pointer">
                {showTrades ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Trades e Histórico
              </Label>
              <Switch
                id="show-trades"
                checked={showTrades}
                onCheckedChange={setShowTrades}
                disabled={!isPublic}
              />
            </div>
          </div>

          {!isPublic && (
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              ⚠️ As opções de métricas só ficam disponíveis quando o perfil é público.
            </p>
          )}
        </div>

        {/* Save/Reset Buttons */}
        {hasChanges && (
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isSaving || !displayName.trim()}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              Desfazer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
