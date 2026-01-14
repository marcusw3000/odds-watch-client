import { Settings, Bell, User, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { LeaderboardProfileSettings } from '@/components/leaderboard/LeaderboardProfileSettings';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function SettingsPage() {
  const { user } = useAuth();

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

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <User className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="leaderboard">
          <LeaderboardProfileSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
