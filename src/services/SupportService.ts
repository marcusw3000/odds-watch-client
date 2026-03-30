import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket, SupportMessage, SupportCategory, SupportStatus, SupportPriority } from '@/types/support';

// ============= PROFILE CACHE =============

interface CachedProfile {
  displayName: string;
  avatarUrl: string | null;
  cachedAt: number;
}

const profileCache = new Map<string, CachedProfile>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedProfiles(userIds: string[]): { cached: Map<string, CachedProfile>; uncached: string[] } {
  const now = Date.now();
  const cached = new Map<string, CachedProfile>();
  const uncached: string[] = [];

  for (const userId of userIds) {
    const entry = profileCache.get(userId);
    if (entry && now - entry.cachedAt < CACHE_TTL) {
      cached.set(userId, entry);
    } else {
      uncached.push(userId);
    }
  }

  return { cached, uncached };
}

function setCachedProfiles(profiles: Record<string, { display_name: string; avatar_url: string | null }>) {
  const now = Date.now();
  for (const [userId, profile] of Object.entries(profiles)) {
    profileCache.set(userId, {
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      cachedAt: now,
    });
  }
}

// ============= USER METHODS =============

export async function createTicket(
  subject: string,
  category: SupportCategory,
  message: string
): Promise<SupportTicket | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      subject,
      category,
    })
    .select()
    .single();

  if (ticketError) throw ticketError;

  // Create initial message
  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      message,
      is_staff: false,
    });

  if (messageError) throw messageError;

  return ticket as SupportTicket;
}

export async function getMyTickets(): Promise<SupportTicket[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SupportTicket[];
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  // Fetch only required fields for faster response
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, ticket_id, sender_id, message, is_staff, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const messages = data || [];
  const userIds = [...new Set(messages.map((m: any) => m.sender_id))];
  
  // Check cache first
  const { cached, uncached } = getCachedProfiles(userIds);
  const displayInfoMap = new Map<string, { displayName: string; avatarUrl: string | null }>();

  // Add cached entries to map
  for (const [userId, profile] of cached) {
    displayInfoMap.set(userId, {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
  }

  // Return messages immediately with cached/fallback data, fetch uncached profiles async
  const enrichedMessages = messages.map((msg: any) => ({
    ...msg,
    sender_name: msg.is_staff 
      ? 'Equipe de Suporte' 
      : (displayInfoMap.get(msg.sender_id)?.displayName || 'Usuário'),
    sender_avatar: displayInfoMap.get(msg.sender_id)?.avatarUrl || null,
  }));

  // Fetch uncached profiles in background (non-blocking for subsequent calls)
  if (uncached.length > 0) {
    supabase.functions.invoke('get-users-display-info-batch', {
      body: { user_ids: uncached, ticket_id: ticketId },
    }).then(({ data: batchData }) => {
      if (batchData?.profiles) {
        setCachedProfiles(batchData.profiles);
      }
    }).catch(err => {
      console.error('Error fetching batch profiles:', err);
    });
  }

  return enrichedMessages;
}

export async function sendMessage(ticketId: string, message: string): Promise<SupportMessage | null> {
  const { data, error } = await supabase.functions.invoke('manage-support-tickets', {
    body: {
      action: 'send_user_message',
      ticketId,
      message,
    },
  });

  if (error) throw error;
  return (data?.message ?? null) as SupportMessage | null;
}

// ============= ADMIN METHODS =============

export interface TicketFilters {
  status?: SupportStatus;
  category?: SupportCategory;
  priority?: SupportPriority;
  assignedTo?: string | 'unassigned';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TicketsResponse {
  tickets: SupportTicket[];
  totalCount: number;
}

export async function getAllTickets(filters?: TicketFilters): Promise<TicketsResponse> {
  const { data, error } = await supabase.functions.invoke('get-admin-support-tickets', {
    body: filters || {},
  });

  if (error) throw error;
  
  // Handle both old format (array) and new format (object with tickets and totalCount)
  if (Array.isArray(data)) {
    return { tickets: data, totalCount: data.length };
  }
  return data || { tickets: [], totalCount: 0 };
}

export async function getTicketById(ticketId: string): Promise<SupportTicket | null> {
  const { data, error } = await supabase.functions.invoke('get-admin-support-tickets', {
    body: { ticketId },
  });

  if (error) throw error;
  return data?.[0] || null;
}

export async function assignTicket(ticketId: string, userId: string | null): Promise<void> {
  const { error } = await supabase.functions.invoke('manage-support-tickets', {
    body: {
      action: 'assign',
      ticketId,
      assignedTo: userId,
    },
  });

  if (error) throw error;
}

export async function updateTicketStatus(ticketId: string, status: SupportStatus): Promise<void> {
  const { error } = await supabase.functions.invoke('manage-support-tickets', {
    body: {
      action: 'update_status',
      ticketId,
      status,
    },
  });

  if (error) throw error;
}

export async function updateTicketPriority(ticketId: string, priority: SupportPriority): Promise<void> {
  const { error } = await supabase.functions.invoke('manage-support-tickets', {
    body: {
      action: 'update_priority',
      ticketId,
      priority,
    },
  });

  if (error) throw error;
}

export async function sendStaffMessage(ticketId: string, message: string): Promise<SupportMessage | null> {
  const { data, error } = await supabase.functions.invoke('manage-support-tickets', {
    body: {
      action: 'send_staff_message',
      ticketId,
      message,
    },
  });

  if (error) throw error;
  return (data?.message ?? null) as SupportMessage | null;
}

export async function getTicketStats(): Promise<{
  open: number;
  in_progress: number;
  waiting_customer: number;
  resolved_today: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('support_tickets')
    .select('status, closed_at');

  if (error) throw error;

  const stats = {
    open: 0,
    in_progress: 0,
    waiting_customer: 0,
    resolved_today: 0,
  };

  (data || []).forEach((ticket: any) => {
    if (ticket.status === 'open') stats.open++;
    if (ticket.status === 'in_progress') stats.in_progress++;
    if (ticket.status === 'waiting_customer') stats.waiting_customer++;
    if (
      (ticket.status === 'resolved' || ticket.status === 'closed') &&
      ticket.closed_at &&
      new Date(ticket.closed_at) >= today
    ) {
      stats.resolved_today++;
    }
  });

  return stats;
}
