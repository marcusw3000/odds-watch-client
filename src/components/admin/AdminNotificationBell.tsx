import { Link } from 'react-router-dom';
import { 
  Bell, 
  Headphones, 
  Clock, 
  AlertTriangle, 
  DollarSign,
  Check,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAdminNotifications, AdminAlert } from '@/hooks/useAdminNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getAlertIcon(type: AdminAlert['type']) {
  switch (type) {
    case 'support_ticket':
      return <Headphones className="h-4 w-4 text-primary" />;
    case 'market_expiring':
      return <Clock className="h-4 w-4 text-warning" />;
    case 'contestation':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'high_deposit':
      return <DollarSign className="h-4 w-4 text-green-500" />;
  }
}

export function AdminNotificationBell() {
  const { alerts, unreadCount, isLoading, markAsRead, markAllAsRead } = useAdminNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold">Alertas</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto py-1 px-2 text-xs"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Marcar lidos
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum alerta
            </p>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  to={alert.link}
                  onClick={() => markAsRead(alert.id)}
                  className={`flex items-start gap-3 p-3 hover:bg-muted transition-colors ${
                    !alert.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      {!alert.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
