import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminAlert {
  id: string;
  type: 'support_ticket' | 'high_deposit' | 'market_expiring' | 'contestation';
  title: string;
  description: string;
  link: string;
  createdAt: Date;
  read: boolean;
}

const STORAGE_KEY = 'admin-read-alerts';

function getReadAlerts(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadAlerts(readAlerts: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...readAlerts]));
}

export function useAdminNotifications() {
  const queryClient = useQueryClient();
  const [readAlerts, setReadAlerts] = useState<Set<string>>(getReadAlerts);

  const { data: alerts = [], isLoading, isError } = useQuery<AdminAlert[]>({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const allAlerts: AdminAlert[] = [];
      const storedReadAlerts = getReadAlerts();

      // Fetch open support tickets
      const { data: tickets, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id, subject, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      if (ticketError) throw ticketError;

      tickets?.forEach((t) => {
        allAlerts.push({
          id: `ticket-${t.id}`,
          type: 'support_ticket',
          title: 'Novo Ticket de Suporte',
          description: t.subject,
          link: '/admin/support',
          createdAt: new Date(t.created_at),
          read: storedReadAlerts.has(`ticket-${t.id}`),
        });
      });

      // Sort by date (most recent first)
      return allAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Real-time subscription for new support tickets
  useEffect(() => {
    const channel = supabase
      .channel('admin-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const markAsRead = useCallback((alertId: string) => {
    setReadAlerts((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      saveReadAlerts(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadAlerts((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadAlerts(next);
      return next;
    });
  }, [alerts]);

  // Apply read status from state
  const alertsWithReadStatus = alerts.map((alert) => ({
    ...alert,
    read: readAlerts.has(alert.id),
  }));

  const unreadCount = alertsWithReadStatus.filter((a) => !a.read).length;

  return {
    alerts: alertsWithReadStatus,
    unreadCount,
    isLoading,
    isError,
    markAsRead,
    markAllAsRead,
  };
}
