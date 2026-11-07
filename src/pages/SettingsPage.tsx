import { Settings, Bell, Shield, Download, Headphones, User, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { ExportDataButton } from '@/components/settings/ExportDataButton';
import { SupportTicketsList } from '@/components/support/SupportTicketsList';
import { ProfilePrivacySettings } from '@/components/profile/ProfilePrivacySettings';
import { useAuth } from '@/hooks/useAuth';
import { useMyLeaderboardProfile, useUpdateLeaderboardProfile } from '@/hooks/useLeaderboard';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserProfile } from '@/types/leaderboard';

export function SettingsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'notifications';
  
  const { data: leaderboardProfile, isLoading: profileLoading } = useMyLeaderboardProfile();
  const updateProfile = useUpdateLeaderboardProfile();

  const profile: UserProfile | null = leaderboardProfile ? {
    id: leaderboardProfile.id,
    email: null,
    full_name: null,
    avatar_url: leaderboardProfile.avatar_url,
    display_name: leaderboardProfile.display_name,
    bio: leaderboardProfile.bio,
    is_public: leaderboardProfile.is_public,
    show_profit: leaderboardProfile.show_profit,
    show_roi: leaderboardProfile.show_roi,
    show_volume: leaderboardProfile.show_volume,
    show_trades: leaderboardProfile.show_trades,
    total_profit: 0,
    roi_percent: 0,
    total_volume: 0,
    total_trades: 0,
    winning_trades: 0,
    current_streak: 0,
    best_streak: 0,
    best_trade_profit: 0,
    created_at: leaderboardProfile.created_at,
    updated_at: leaderboardProfile.updated_at,
  } : null;

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    await updateProfile.mutateAsync(updates);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground mb-6">
          Faça login para acessar suas configurações.
        </p>
        <Button asChild>
          <Link to="/auth">Entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Configurações</h1>
        </div>
        <p className="text-muted-foreground">
          Gerencie suas preferências de conta e notificações.
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Suporte</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacidade</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="profile">
          {profileLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : profile ? (
            <ProfilePrivacySettings
              profile={profile}
              onUpdate={handleUpdateProfile}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Erro ao Carregar
                </CardTitle>
                <CardDescription>
                  Não foi possível carregar suas configurações de perfil.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/profile?tab=settings">Tentar na página do perfil</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="support">
          <SupportTicketsList />
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Dados (LGPD)
              </CardTitle>
              <CardDescription>
                Exporte todos os seus dados pessoais armazenados na plataforma em formato JSON ou CSV.
                De acordo com a Lei Geral de Proteção de Dados, você tem direito à portabilidade dos seus dados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ExportDataButton />
              <p className="text-xs text-muted-foreground">
                O arquivo incluirá perfil, carteira, posições e operações simuladas, convites, favoritos, pagamentos, notificações e comentários.
                Você pode exportar seus dados uma vez por hora.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
