-- Adicionar coluna para chave de idempotência
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Criar índice único para prevenir duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key 
ON public.payments(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Função que verifica se existe saque pendente nos últimos 30 segundos
CREATE OR REPLACE FUNCTION public.check_pending_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_pix_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM payments
    WHERE user_id = p_user_id
      AND type = 'WITHDRAWAL'
      AND status = 'PENDING'
      AND amount = p_amount
      AND pix_key = p_pix_key
      AND created_at > NOW() - INTERVAL '30 seconds'
  );
END;
$$;