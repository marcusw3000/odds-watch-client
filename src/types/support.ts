export type SupportCategory = 'account' | 'payment' | 'trading' | 'technical' | 'other';
export type SupportStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  // Joined data
  user_email?: string;
  user_display_name?: string;
  assigned_name?: string;
  last_message?: string;
  message_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export const CATEGORY_LABELS: Record<SupportCategory, string> = {
  account: 'Conta',
  payment: 'Pagamento',
  trading: 'Trading',
  technical: 'Técnico',
  other: 'Outro',
};

export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_customer: 'Aguardando Cliente',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export const PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};
