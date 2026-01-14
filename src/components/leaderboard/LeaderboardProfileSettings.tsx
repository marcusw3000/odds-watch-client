import { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMyLeaderboardProfile, useUpdateLeaderboardProfile, useInitializeUserStats } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';

export function LeaderboardProfileSettings() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyLeaderboardProfile();
  const updateProfile = useUpdateLeaderboardProfile();
  const initStats = useInitializeUserStats();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    display_name: '',
    is_public: false,
    show_profit: true,
    show_roi: true,
    show_volume: true,
    show_trades: true,
    bio: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name,
        is_public: profile.is_public,
        show_profit: profile.show_profit,
        show_roi: profile.show_roi,
        show_volume: profile.show_volume,
        show_trades: profile.show_trades,
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      // Initialize stats if needed
      await initStats.mutateAsync();
      
      await updateProfile.mutateAsync(formData);
      toast({
        title: 'Perfil atualizado',
        description: formData.is_public 
          ? 'Seu perfil agora está visível no leaderboard!' 
          : 'Seu perfil foi atualizado.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar seu perfil.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Faça login para configurar seu perfil do leaderboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Configurações do Leaderboard
        </CardTitle>
        <CardDescription>
          Configure como você aparece no ranking público. Você controla quais métricas são exibidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3">
            {formData.is_public ? (
              <Eye className="h-5 w-5 text-green-500" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label htmlFor="is_public" className="text-base font-medium">
                Participar do Leaderboard
              </Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_public 
                  ? 'Seu perfil está visível publicamente'
                  : 'Seu perfil está oculto do ranking'}
              </p>
            </div>
          </div>
          <Switch
            id="is_public"
            checked={formData.is_public}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
          />
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display_name">Nome de Exibição</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="Seu apelido no ranking"
            maxLength={30}
          />
          <p className="text-xs text-muted-foreground">
            Este nome será exibido publicamente no leaderboard.
          </p>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio (opcional)</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Uma breve descrição sobre você..."
            maxLength={200}
            rows={3}
          />
        </div>

        {/* Privacy Controls */}
        <div className="space-y-4">
          <Label className="text-base">Métricas Visíveis</Label>
          <p className="text-sm text-muted-foreground -mt-2">
            Escolha quais estatísticas outros usuários podem ver.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show_profit" className="cursor-pointer">Lucro Total</Label>
              <Switch
                id="show_profit"
                checked={formData.show_profit}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_profit: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show_roi" className="cursor-pointer">ROI %</Label>
              <Switch
                id="show_roi"
                checked={formData.show_roi}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_roi: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show_volume" className="cursor-pointer">Volume</Label>
              <Switch
                id="show_volume"
                checked={formData.show_volume}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_volume: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label htmlFor="show_trades" className="cursor-pointer">Nº de Trades</Label>
              <Switch
                id="show_trades"
                checked={formData.show_trades}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_trades: checked }))}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          className="w-full"
          disabled={updateProfile.isPending || !formData.display_name.trim()}
        >
          <Save className="h-4 w-4 mr-2" />
          {updateProfile.isPending ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
}
