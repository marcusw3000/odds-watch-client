import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket, SupportMessage, SupportCategory, SupportStatus, SupportPriority } from '@/types/support';

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
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Fetch display info via Edge Function for each unique sender
  const messages = data || [];
  const userIds = [...new Set(messages.map((m: any) => m.sender_id))];
  const displayInfoMap = new Map<string, { displayName: string; avatarUrl: string | null }>();

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const { data: info } = await supabase.functions.invoke('get-user-display-info', {
          body: null,
          headers: {},
        });
        // Use query params approach
        const response = await supabase.functions.invoke(
          `get-user-display-info?user_id=${encodeURIComponent(userId)}&context=support`,
          { method: 'GET' }
        );
        if (response.data) {
          displayInfoMap.set(userId, {
            displayName: response.data.display_name || 'Usuário',
            avatarUrl: response.data.avatar_url,
          });
        }
      } catch {
        // Fallback if edge function fails
        displayInfoMap.set(userId, { displayName: 'Usuário', avatarUrl: null });
      }
    })
  );

  return messages.map((msg: any) => ({
    ...msg,
    sender_name: msg.is_staff 
      ? 'Equipe de Suporte' 
      : (displayInfoMap.get(msg.sender_id)?.displayName || 'Usuário'),
    sender_avatar: displayInfoMap.get(msg.sender_id)?.avatarUrl,
  }));
}

export async function sendMessage(ticketId: string, message: string): Promise<SupportMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message,
      is_staff: false,
    })
    .select()
    .single();

  if (error) throw error;

  // Update ticket status to in_progress if it was waiting_customer
  await supabase
    .from('support_tickets')
    .update({ status: 'in_progress' })
    .eq('id', ticketId)
    .eq('status', 'waiting_customer');

  return data as SupportMessage;
}

// ============= ADMIN METHODS =============

export interface TicketFilters {
  status?: SupportStatus;
  category?: SupportCategory;
  priority?: SupportPriority;
  assignedTo?: string | 'unassigned';
  search?: string;
}

export async function getAllTickets(filters?: TicketFilters): Promise<SupportTicket[]> {
  let query = supabase
    .from('support_tickets')
    .select(`
      *,
      user_profile:user_id(display_name, email),
      assigned_profile:assigned_to(display_name)
    `)
    .order('updated_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.assignedTo === 'unassigned') {
    query = query.is('assigned_to', null);
  } else if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }
  if (filters?.search) {
    query = query.ilike('subject', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((ticket: any) => ({
    ...ticket,
    user_display_name: ticket.user_profile?.display_name,
    user_email: ticket.user_profile?.email,
    assigned_name: ticket.assigned_profile?.display_name,
  }));
}

export async function getTicketById(ticketId: string): Promise<SupportTicket | null> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`
      *,
      user_profile:user_id(display_name, email),
      assigned_profile:assigned_to(display_name)
    `)
    .eq('id', ticketId)
    .single();

  if (error) throw error;

  return {
    ...data,
    user_display_name: (data as any).user_profile?.display_name,
    user_email: (data as any).user_profile?.email,
    assigned_name: (data as any).assigned_profile?.display_name,
  } as SupportTicket;
}

export async function assignTicket(ticketId: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('support_tickets')
    .update({
      assigned_to: userId,
      status: userId ? 'in_progress' : 'open',
    })
    .eq('id', ticketId);

  if (error) throw error;
}

export async function updateTicketStatus(ticketId: string, status: SupportStatus): Promise<void> {
  const updateData: any = { status };
  
  if (status === 'closed' || status === 'resolved') {
    updateData.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('support_tickets')
    .update(updateData)
    .eq('id', ticketId);

  if (error) throw error;

  // Notify user when ticket is resolved or closed
  if (status === 'resolved' || status === 'closed') {
    try {
      await supabase.functions.invoke('notify-support-reply', {
        body: {
          ticket_id: ticketId,
          message_preview: null,
          action: status,
        },
      });
    } catch (notifyError) {
      console.error('Error notifying user about ticket resolution:', notifyError);
      // Don't fail the operation if notification fails
    }
  }
}

export async function updateTicketPriority(ticketId: string, priority: SupportPriority): Promise<void> {
  const { error } = await supabase
    .from('support_tickets')
    .update({ priority })
    .eq('id', ticketId);

  if (error) throw error;
}

export async function sendStaffMessage(ticketId: string, message: string): Promise<SupportMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Send message
  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message,
      is_staff: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Update ticket status to waiting_customer
  await supabase
    .from('support_tickets')
    .update({ status: 'waiting_customer' })
    .eq('id', ticketId);

  // Notify user about the reply via Edge Function
  try {
    const messagePreview = message.length > 100 ? message.substring(0, 100) : message;
    await supabase.functions.invoke('notify-support-reply', {
      body: {
        ticket_id: ticketId,
        message_preview: messagePreview,
        action: 'reply',
      },
    });
  } catch (notifyError) {
    console.error('Error notifying user about support reply:', notifyError);
    // Don't fail the operation if notification fails
  }

  return data as SupportMessage;
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
