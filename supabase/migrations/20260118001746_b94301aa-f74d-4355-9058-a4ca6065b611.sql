-- Create ENUMs for support system
CREATE TYPE support_category AS ENUM ('account', 'payment', 'trading', 'technical', 'other');
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
CREATE TYPE support_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category support_category NOT NULL DEFAULT 'other',
  status support_status NOT NULL DEFAULT 'open',
  priority support_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can create their own tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can update tickets"
ON public.support_tickets FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

-- RLS Policies for support_messages
CREATE POLICY "Users can view messages of their tickets"
ON public.support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
  )
);

CREATE POLICY "Users can send messages to their tickets"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets t 
    WHERE t.id = ticket_id 
    AND (
      (t.user_id = auth.uid() AND t.status NOT IN ('closed', 'resolved'))
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'moderator')
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);

-- Create trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();