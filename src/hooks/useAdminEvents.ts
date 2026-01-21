import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketStatus } from '@/types/market';

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: MarketStatus;
  market_type: 'BINARY' | 'MULTIPLE';
  current_yes_price: number;
  current_no_price: number;
  total_volume: number;
  close_date: string | null;
  settlement_date: string | null;
  result: string | null;
  result_source: string | null;
  halt_reason: string | null;
  image_url: string | null;
  tags: string[] | null;
  card_style: string | null;
  recurrence_type: string | null;
  parent_market_id: string | null;
  created_at: string;
  updated_at: string;
  settlement_type: string;
  resolution: Record<string, unknown> | null;
  options_exclusive: boolean;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface EventsFilters {
  search?: string;
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

interface EventsResponse {
  events: AdminEvent[];
  totalCount: number;
}

interface EventDetailResponse {
  event: AdminEvent;
  auditLogs: AdminAuditLog[];
}

export function useAdminEvents(filters: EventsFilters = {}) {
  const { search, status, category, limit = 25, offset = 0 } = filters;

  return useQuery<EventsResponse>({
    queryKey: ['admin-events', search, status, category, limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-admin-events', {
        method: 'POST',
        body: { search, status, category, limit, offset },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data as EventsResponse;
    },
  });
}

export function useAdminEvent(eventId: string | undefined) {
  return useQuery<EventDetailResponse>({
    queryKey: ['admin-event', eventId],
    queryFn: async () => {
      if (!eventId) throw new Error('Event ID required');

      const { data, error } = await supabase.functions.invoke('get-admin-event', {
        method: 'POST',
        body: { eventId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data as EventDetailResponse;
    },
    enabled: !!eventId,
  });
}

export function useUpdateEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
      reason,
    }: {
      eventId: string;
      status: MarketStatus;
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-admin-event', {
        method: 'POST',
        body: {
          action: 'update_status',
          eventId,
          status,
          reason,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-event', variables.eventId] });
    },
  });
}

export function useSettleEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      result,
      evidence,
    }: {
      eventId: string;
      result: 'YES' | 'NO';
      evidence: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('update-admin-event', {
        method: 'POST',
        body: {
          action: 'settle',
          eventId,
          result,
          evidence,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-event', variables.eventId] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('update-admin-event', {
        method: 'POST',
        body: {
          action: 'delete',
          eventId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });
}

export function useUpdateCardStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      cardStyle,
    }: {
      eventId: string;
      cardStyle: 'default' | 'buttons' | 'simple' | 'minimal';
    }) => {
      const { data, error } = await supabase.functions.invoke('update-admin-event', {
        method: 'POST',
        body: {
          action: 'update_card_style',
          eventId,
          cardStyle,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-event', variables.eventId] });
    },
  });
}

export interface CreateEventData {
  title: string;
  description: string;
  category: string;
  closeDate: string;
  settlementDate: string;
  imageUrl?: string;
  tags?: string[];
  yesPrice?: number;
  settlementType?: string;
  resolution?: Record<string, unknown>;
  cardStyle?: 'default' | 'buttons' | 'simple' | 'minimal';
  marketType?: 'BINARY' | 'MULTIPLE';
  recurrenceType?: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  options?: Array<{
    label: string;
    description?: string;
    imageUrl?: string;
    probability: number;
    displayOrder: number;
  }>;
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      const { data, error } = await supabase.functions.invoke('create-admin-event', {
        method: 'POST',
        body: eventData,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });
}

export interface UpdateEventData {
  eventId: string;
  title?: string;
  description?: string;
  category?: string;
  closeDate?: string;
  settlementDate?: string;
  imageUrl?: string;
  tags?: string[];
  yesPrice?: number;
  settlementType?: string;
  resolution?: Record<string, unknown>;
  cardStyle?: 'default' | 'buttons' | 'simple' | 'minimal';
  reason?: string;
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, ...updateData }: UpdateEventData) => {
      const { data, error } = await supabase.functions.invoke('update-admin-event', {
        method: 'POST',
        body: {
          action: 'update_event',
          eventId,
          ...updateData,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-event', variables.eventId] });
    },
  });
}

// === Dashboard Metrics ===

export interface AdminMetrics {
  totalEvents: number;
  openEvents: number;
  pausedEvents: number;
  closedEvents: number;
  awaitingSettlement: number;
  settledEvents: number;
}

export function useAdminMetrics() {
  return useQuery<AdminMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('status, close_date');

      if (error) throw new Error(error.message);

      const now = new Date();
      const metrics: AdminMetrics = {
        totalEvents: data.length,
        openEvents: data.filter(e => e.status === 'OPEN').length,
        pausedEvents: data.filter(e => e.status === 'HALTED').length,
        closedEvents: data.filter(e => e.status === 'PENDING').length,
        awaitingSettlement: data.filter(e => 
          e.status === 'PENDING' && e.close_date && new Date(e.close_date) < now
        ).length,
        settledEvents: data.filter(e => e.status === 'SETTLED').length,
      };

      return metrics;
    },
  });
}

export function useExpiringEvents(days: number = 7) {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin-expiring-events', days],
    queryFn: async () => {
      const now = new Date();
      const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'OPEN')
        .gt('close_date', now.toISOString())
        .lte('close_date', threshold.toISOString())
        .order('close_date', { ascending: true });

      if (error) throw new Error(error.message);

      return data as AdminEvent[];
    },
  });
}

export function useRecentEvents(limit: number = 5) {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin-recent-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return data as AdminEvent[];
    },
  });
}

export function usePendingSettlements() {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin-pending-settlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('*')
        .in('status', ['PENDING', 'CONTESTED'])
        .order('close_date', { ascending: true });

      if (error) throw new Error(error.message);

      return data as AdminEvent[];
    },
  });
}

// === Audit Logs ===

export interface AuditLogEntry {
  id: string;
  action: string;
  actor_user_id: string;
  entity: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export function useAdminAuditLogs(actionFilter?: string) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['admin-audit-logs', actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message);

      return data as AuditLogEntry[];
    },
  });
}

// === Bulk Actions ===

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      status,
    }: {
      eventIds: string[];
      status: MarketStatus;
    }) => {
      const results = await Promise.allSettled(
        eventIds.map((eventId) =>
          supabase.functions.invoke('update-admin-event', {
            method: 'POST',
            body: { action: 'update_status', eventId, status },
          })
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { successful, failed, total: eventIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });
}

export function useBulkDeleteEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      const results = await Promise.allSettled(
        eventIds.map((eventId) =>
          supabase.functions.invoke('update-admin-event', {
            method: 'POST',
            body: { action: 'delete', eventId },
          })
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { successful, failed, total: eventIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });
}
