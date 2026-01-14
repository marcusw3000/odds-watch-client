import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, TrendingUp, Trophy, Gift, AlertCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useDeleteNotification 
} from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import type { NotificationType } from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const notificationIcons: Record<NotificationType, React.ElementType> = {
  MARKET_CLOSING_SOON: AlertCircle,
  MARKET_HALTED: AlertCircle,
  MARKET_SETTLED: TrendingUp,
  TRADE_EXECUTED: TrendingUp,
  ACHIEVEMENT_UNLOCKED: Trophy,
  LEADERBOARD_RANK: Trophy,
  REFERRAL_ACTIVATED: Gift,
  SYSTEM_ANNOUNCEMENT: Megaphone,
};

const notificationColors: Record<NotificationType, string> = {
  MARKET_CLOSING_SOON: 'text-orange-500 bg-orange-500/10',
  MARKET_HALTED: 'text-red-500 bg-red-500/10',
  MARKET_SETTLED: 'text-green-500 bg-green-500/10',
  TRADE_EXECUTED: 'text-blue-500 bg-blue-500/10',
  ACHIEVEMENT_UNLOCKED: 'text-yellow-500 bg-yellow-500/10',
  LEADERBOARD_RANK: 'text-purple-500 bg-purple-500/10',
  REFERRAL_ACTIVATED: 'text-pink-500 bg-pink-500/10',
  SYSTEM_ANNOUNCEMENT: 'text-primary bg-primary/10',
};

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  // Show toast when new notification arrives
  useEffect(() => {
    if (unreadCount > prevUnreadCount && prevUnreadCount !== 0) {
      const latestUnread = notifications.find(n => !n.is_read);
      if (latestUnread) {
        toast({
          title: latestUnread.title,
          description: latestUnread.message,
        });
      }
    }
    setPrevUnreadCount(unreadCount);
  }, [unreadCount, notifications, toast, prevUnreadCount]);

  if (!user) return null;

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleDelete = (id: string) => {
    deleteNotification.mutate(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const colorClass = notificationColors[notification.type] || 'text-muted-foreground bg-muted';
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors ${
                      !notification.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMarkRead(notification.id)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(notification.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
