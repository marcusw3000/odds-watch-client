import { useState, useEffect } from 'react';
import { Bell, Mail, Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';

export function NotificationSettings() {
  const { user } = useAuth();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    in_app_market_updates: true,
    in_app_trade_updates: true,
    in_app_achievements: true,
    in_app_system: true,
    email_market_settled: true,
    email_market_closing: true,
    email_weekly_summary: false,
    email_marketing: false,
  });

  useEffect(() => {
    if (preferences) {
      setFormData({
        in_app_market_updates: preferences.in_app_market_updates,
        in_app_trade_updates: preferences.in_app_trade_updates,
        in_app_achievements: preferences.in_app_achievements,
        in_app_system: preferences.in_app_system,
        email_market_settled: preferences.email_market_settled,
        email_market_closing: preferences.email_market_closing,
        email_weekly_summary: preferences.email_weekly_summary,
        email_marketing: preferences.email_marketing,
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync(formData);
      toast({
        title: 'Preferências salvas',
        description: 'Suas configurações de notificação foram atualizadas.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar suas preferências.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Faça login para configurar suas notificações.</p>
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
          <Bell className="h-5 w-5" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>
          Configure como e quando você deseja receber notificações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* In-App Notifications */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Notificações no App</h4>
          </div>
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="in_app_market_updates">Atualizações de Mercado</Label>
                <p className="text-xs text-muted-foreground">
                  Mercados próximos do fechamento, halts, resultados
                </p>
              </div>
              <Switch
                id="in_app_market_updates"
                checked={formData.in_app_market_updates}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, in_app_market_updates: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="in_app_trade_updates">Atualizações de Trades</Label>
                <p className="text-xs text-muted-foreground">
                  Confirmações de compra/venda, execuções
                </p>
              </div>
              <Switch
                id="in_app_trade_updates"
                checked={formData.in_app_trade_updates}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, in_app_trade_updates: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="in_app_achievements">Conquistas</Label>
                <p className="text-xs text-muted-foreground">
                  Badges desbloqueados, ranking atualizado
                </p>
              </div>
              <Switch
                id="in_app_achievements"
                checked={formData.in_app_achievements}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, in_app_achievements: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="in_app_system">Avisos do Sistema</Label>
                <p className="text-xs text-muted-foreground">
                  Manutenções, novidades, anúncios importantes
                </p>
              </div>
              <Switch
                id="in_app_system"
                checked={formData.in_app_system}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, in_app_system: checked }))
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Email Notifications */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Notificações por Email</h4>
          </div>
          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_market_settled">Resultado de Mercados</Label>
                <p className="text-xs text-muted-foreground">
                  Quando um mercado que você apostou é liquidado
                </p>
              </div>
              <Switch
                id="email_market_settled"
                checked={formData.email_market_settled}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, email_market_settled: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_market_closing">Mercado Fechando</Label>
                <p className="text-xs text-muted-foreground">
                  Alertas de mercados próximos do encerramento
                </p>
              </div>
              <Switch
                id="email_market_closing"
                checked={formData.email_market_closing}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, email_market_closing: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_weekly_summary">Resumo Semanal</Label>
                <p className="text-xs text-muted-foreground">
                  Resumo semanal de performance e oportunidades
                </p>
              </div>
              <Switch
                id="email_weekly_summary"
                checked={formData.email_weekly_summary}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, email_weekly_summary: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email_marketing">Marketing</Label>
                <p className="text-xs text-muted-foreground">
                  Promoções, novidades e ofertas especiais
                </p>
              </div>
              <Switch
                id="email_marketing"
                checked={formData.email_marketing}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, email_marketing: checked }))
                }
              />
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="w-full"
          disabled={updatePreferences.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {updatePreferences.isPending ? 'Salvando...' : 'Salvar Preferências'}
        </Button>
      </CardContent>
    </Card>
  );
}
