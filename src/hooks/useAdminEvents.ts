import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketStatus } from '@/types/market';

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: MarketStatus;
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
  created_at: string;
  updated_at: string;
  settlement_type: string;
  resolution: Record<string, unknown> | null;
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
