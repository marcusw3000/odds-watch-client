import { Settings, Bell, User, Shield, Download, Headphones } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { LeaderboardProfileSettings } from '@/components/leaderboard/LeaderboardProfileSettings';
import { ExportDataButton } from '@/components/settings/ExportDataButton';
import { SupportTicketsList } from '@/components/support/SupportTicketsList';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Leaderboard</span>
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

        <TabsContent value="leaderboard">
          <LeaderboardProfileSettings />
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
                O arquivo incluirá: perfil, transações, contratos, pagamentos, notificações, conquistas e comentários.
                Você pode exportar seus dados uma vez por hora.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
