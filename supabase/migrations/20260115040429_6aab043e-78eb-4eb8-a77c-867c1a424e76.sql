-- Create deposit/withdrawal transaction types
CREATE TYPE public.payment_type AS ENUM ('DEPOSIT', 'WITHDRAWAL');
CREATE TYPE public.payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE public.payment_method AS ENUM ('PIX', 'CARD', 'BOLETO');

-- Create payments/transactions table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type payment_type NOT NULL,
  method payment_method NOT NULL DEFAULT 'PIX',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  fee NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  -- Stripe fields
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_refund_id TEXT,
  -- PIX fields
  pix_code TEXT,
  pix_qr_code_url TEXT,
  pix_expires_at TIMESTAMP WITH TIME ZONE,
  -- Withdrawal fields
  pix_key TEXT,
  pix_key_type TEXT,
  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX idx_payments_stripe_session ON public.payments(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
ON public.payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update payments"
ON public.payments FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all payments"
ON public.payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();