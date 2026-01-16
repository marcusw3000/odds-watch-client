import { useState } from 'react';
import { Eye, EyeOff, Shield, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { UserProfile } from '@/types/leaderboard';

interface ProfilePrivacySettingsProps {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfilePrivacySettings({ profile, onUpdate }: ProfilePrivacySettingsProps) {
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [showProfit, setShowProfit] = useState(profile.show_profit);
  const [showROI, setShowROI] = useState(profile.show_roi);
  const [showVolume, setShowVolume] = useState(profile.show_volume);
  const [showTrades, setShowTrades] = useState(profile.show_trades);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = 
    isPublic !== profile.is_public ||
    showProfit !== profile.show_profit ||
    showROI !== profile.show_roi ||
    showVolume !== profile.show_volume ||
    showTrades !== profile.show_trades;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
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
          Configurações de Privacidade
        </CardTitle>
        <CardDescription>
          Controle o que outros usuários podem ver no seu perfil
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public Profile Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="public-profile" className="text-base font-medium">
              Perfil Público
            </Label>
            <p className="text-sm text-muted-foreground">
              Permitir que outros usuários vejam seu perfil e estatísticas
            </p>
          </div>
          <Switch
            id="public-profile"
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
        </div>

        <Separator />

        {/* Individual Metric Toggles */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Métricas visíveis no leaderboard e perfil público:
          </p>

          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-profit" className="flex items-center gap-2">
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

            <div className="flex items-center justify-between">
              <Label htmlFor="show-roi" className="flex items-center gap-2">
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

            <div className="flex items-center justify-between">
              <Label htmlFor="show-volume" className="flex items-center gap-2">
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

            <div className="flex items-center justify-between">
              <Label htmlFor="show-trades" className="flex items-center gap-2">
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
            <Button onClick={handleSave} disabled={isSaving}>
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
