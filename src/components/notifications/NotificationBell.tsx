import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, CheckCheck, Trash2, TrendingUp, Trophy, Gift, 
  AlertCircle, Megaphone, Heart, MessageCircle, AtSign, Wallet,
  CheckCircle, XCircle, Clock, ChevronRight, Headphones, Flag, Scale, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  useDeleteNotification 
} from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import type { NotificationType, Notification } from '@/types/notification';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NotificationSkeleton } from './NotificationSkeleton';

const notificationIcons: Record<NotificationType, React.ElementType> = {
  MARKET_CLOSING_SOON: AlertCircle,
  MARKET_HALTED: AlertCircle,
  MARKET_SETTLED: TrendingUp,
  TRADE_EXECUTED: TrendingUp,
  ACHIEVEMENT_UNLOCKED: Trophy,
  LEADERBOARD_RANK: Trophy,
  REFERRAL_ACTIVATED: Gift,
  SYSTEM_ANNOUNCEMENT: Megaphone,
  DEPOSIT_CONFIRMED: Wallet,
  WITHDRAWAL_COMPLETED: CheckCircle,
  WITHDRAWAL_FAILED: XCircle,
  WITHDRAWAL_REQUESTED: Clock,
  PRICE_ALERT: TrendingUp,
  COMMENT_MENTION: AtSign,
  COMMENT_LIKE: Heart,
  COMMENT_REPLY: MessageCircle,
  SUGGESTION_COMMENT_MENTION: AtSign,
  SUGGESTION_COMMENT_REPLY: MessageCircle,
  ADMIN_NEW_TICKET: Headphones,
  ADMIN_NEW_REPORT: Flag,
  ADMIN_NEW_CONTESTATION: Scale,
  USER_WARNING: AlertTriangle,
  SUPPORT_REPLY: Headphones,
  SUPPORT_TICKET_RESOLVED: CheckCircle,
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
  DEPOSIT_CONFIRMED: 'text-green-500 bg-green-500/10',
  WITHDRAWAL_COMPLETED: 'text-green-500 bg-green-500/10',
  WITHDRAWAL_FAILED: 'text-red-500 bg-red-500/10',
  WITHDRAWAL_REQUESTED: 'text-yellow-500 bg-yellow-500/10',
  PRICE_ALERT: 'text-blue-500 bg-blue-500/10',
  COMMENT_MENTION: 'text-indigo-500 bg-indigo-500/10',
  COMMENT_LIKE: 'text-pink-500 bg-pink-500/10',
  COMMENT_REPLY: 'text-cyan-500 bg-cyan-500/10',
  SUGGESTION_COMMENT_MENTION: 'text-indigo-500 bg-indigo-500/10',
  SUGGESTION_COMMENT_REPLY: 'text-cyan-500 bg-cyan-500/10',
  ADMIN_NEW_TICKET: 'text-amber-500 bg-amber-500/10',
  ADMIN_NEW_REPORT: 'text-red-500 bg-red-500/10',
  ADMIN_NEW_CONTESTATION: 'text-orange-500 bg-orange-500/10',
  USER_WARNING: 'text-amber-600 bg-amber-600/10',
  SUPPORT_REPLY: 'text-blue-500 bg-blue-500/10',
  SUPPORT_TICKET_RESOLVED: 'text-green-500 bg-green-500/10',
};

// Types that can be grouped
const GROUPABLE_TYPES: NotificationType[] = ['COMMENT_LIKE', 'ACHIEVEMENT_UNLOCKED'];

// Get link for notification based on type and data
function getNotificationLink(notification: Notification): string | null {
  const { type, data } = notification;
  
  switch (type) {
    case 'MARKET_CLOSING_SOON':
    case 'MARKET_HALTED':
    case 'MARKET_SETTLED':
    case 'TRADE_EXECUTED':
    case 'COMMENT_MENTION':
    case 'COMMENT_REPLY':
    case 'COMMENT_LIKE':
    case 'PRICE_ALERT':
      return data?.market_id ? `/market/${data.market_id}` : null;
    
    case 'SUGGESTION_COMMENT_MENTION':
    case 'SUGGESTION_COMMENT_REPLY':
      return data?.suggestion_id ? `/suggestions/${data.suggestion_id}` : null;
    
    case 'DEPOSIT_CONFIRMED':
    case 'WITHDRAWAL_COMPLETED':
    case 'WITHDRAWAL_FAILED':
    case 'WITHDRAWAL_REQUESTED':
      return '/portfolio';
    
    case 'ACHIEVEMENT_UNLOCKED':
      return '/profile';
    
    case 'LEADERBOARD_RANK':
      return '/leaderboard';
    
    case 'REFERRAL_ACTIVATED':
      return '/referral';
    
    // Admin notification types
    case 'ADMIN_NEW_TICKET':
      return '/admin/support';
    
    case 'ADMIN_NEW_REPORT':
      return '/admin/reports';
    
    case 'ADMIN_NEW_CONTESTATION':
      return '/admin/settlements';
    
    // User support notifications
    case 'SUPPORT_REPLY':
    case 'SUPPORT_TICKET_RESOLVED':
      return data?.ticket_id ? `/settings?tab=support&ticket=${data.ticket_id}` : '/settings?tab=support';
    
    default:
      return null;
  }
}

interface GroupedNotification {
  isGroup: true;
  type: NotificationType;
  count: number;
  notifications: Notification[];
  latestTitle: string;
  latestMessage: string;
  latestCreatedAt: string;
  isRead: boolean;
  groupKey: string;
}

type DisplayNotification = (Notification & { isGroup?: false }) | GroupedNotification;

function isGroupedNotification(n: DisplayNotification): n is GroupedNotification {
  return 'isGroup' in n && n.isGroup === true;
}

function groupNotifications(notifications: Notification[]): DisplayNotification[] {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  // Separate recent from older notifications
  const recent: Notification[] = [];
  const older: Notification[] = [];
  
  notifications.forEach(n => {
    if (new Date(n.created_at).getTime() > oneHourAgo) {
      recent.push(n);
    } else {
      older.push(n);
    }
  });
  
  // Group recent notifications by type and context (market_id)
  const grouped = new Map<string, Notification[]>();
  const individual: Notification[] = [];
  
  recent.forEach(n => {
    if (GROUPABLE_TYPES.includes(n.type)) {
      const contextKey = n.data?.market_id || 'global';
      const key = `${n.type}_${contextKey}`;
      grouped.set(key, [...(grouped.get(key) || []), n]);
    } else {
      individual.push(n);
    }
  });
  
  const result: DisplayNotification[] = [...individual.map(n => ({ ...n, isGroup: false as const }))];
  
  grouped.forEach((items, key) => {
    if (items.length > 1) {
      // Create grouped notification
      const typeLabels: Record<string, string> = {
        COMMENT_LIKE: 'curtidas',
        ACHIEVEMENT_UNLOCKED: 'conquistas',
      };
      const label = typeLabels[items[0].type] || 'notificações';
      
      result.push({
        isGroup: true,
        type: items[0].type,
        count: items.length,
        notifications: items,
        latestTitle: `${items.length} ${label}`,
        latestMessage: items[0].message,
        latestCreatedAt: items[0].created_at,
        isRead: items.every(n => n.is_read),
        groupKey: key,
      });
    } else {
      result.push({ ...items[0], isGroup: false as const });
    }
  });
  
  // Add older notifications
  older.forEach(n => result.push({ ...n, isGroup: false as const }));
  
  // Sort by date
  return result.sort((a, b) => {
    const dateA = isGroupedNotification(a) ? a.latestCreatedAt : a.created_at;
    const dateB = isGroupedNotification(b) ? b.latestCreatedAt : b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  // Group notifications
  const displayNotifications = useMemo(() => groupNotifications(notifications), [notifications]);

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

  const handleNotificationClick = (notification: DisplayNotification) => {
    // Mark as read
    if (isGroupedNotification(notification)) {
      // Mark all in group as read
      notification.notifications.forEach(n => {
        if (!n.is_read) markRead.mutate(n.id);
      });
      // Navigate to first item's link
      const firstNotification = notification.notifications[0];
      const link = getNotificationLink(firstNotification);
      if (link) {
        setOpen(false);
        navigate(link);
      }
    } else {
      if (!notification.is_read) {
        handleMarkRead(notification.id);
      }
      const link = getNotificationLink(notification);
      if (link) {
        setOpen(false);
        navigate(link);
      }
    }
  };

  const handleGroupDelete = (group: GroupedNotification) => {
    group.notifications.forEach(n => deleteNotification.mutate(n.id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label={unreadCount > 0 
            ? `Notificações: ${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}` 
            : 'Notificações'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? `${unreadCount} notificações não lidas` : 'Nenhuma notificação nova'}
          </span>
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
        
        <ScrollArea className="h-[400px]" aria-live="polite" aria-label="Lista de notificações">
          {isLoading ? (
            <NotificationSkeleton count={3} />
          ) : displayNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground" role="status">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border" role="list">
              {displayNotifications.map((notification, index) => {
                const isGroup = isGroupedNotification(notification);
                const type = notification.type;
                const Icon = notificationIcons[type] || Bell;
                const colorClass = notificationColors[type] || 'text-muted-foreground bg-muted';
                const isRead = isGroup ? notification.isRead : notification.is_read;
                const title = isGroup ? notification.latestTitle : notification.title;
                const message = isGroup ? notification.latestMessage : notification.message;
                const createdAt = isGroup ? notification.latestCreatedAt : notification.created_at;
                const hasLink = isGroup 
                  ? getNotificationLink(notification.notifications[0]) !== null
                  : getNotificationLink(notification) !== null;
                const key = isGroup ? notification.groupKey : notification.id;
                
                return (
                  <div
                    key={key}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 transition-colors ${
                      !isRead ? 'bg-primary/5' : ''
                    } ${hasLink ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                        {isGroup && (
                          <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                            {notification.count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <p className={`text-sm font-medium ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {title}
                            </p>
                            {hasLink && (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {!isRead && !isGroup && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMarkRead((notification as Notification).id)}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (isGroup) {
                                  handleGroupDelete(notification);
                                } else {
                                  handleDelete((notification as Notification).id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(createdAt), {
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
