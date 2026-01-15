-- =====================================================
-- FASE 1: Completar Unificação de Saldo (PARTE FINAL)
-- =====================================================

-- 1. Criar função handle_new_user_wallet (faltava na migração anterior)
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_available, total_deposited, currency)
  VALUES (NEW.id, 1000, 1000, 'BRL')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Dropar trigger antigo que depende de handle_new_user_balance
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Dropar função antiga
DROP FUNCTION IF EXISTS public.handle_new_user_balance();

-- 4. Dropar outros triggers relacionados a user_balances
DROP TRIGGER IF EXISTS sync_balance_to_wallet ON public.user_balances;
DROP TRIGGER IF EXISTS on_new_user_balance ON public.user_balances;
DROP FUNCTION IF EXISTS public.sync_user_balance_to_wallet();

-- 5. Criar novo trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_wallet();

-- 6. Dropar tabela user_balances (dados já migrados para wallets)
DROP TABLE IF EXISTS public.user_balances CASCADE;

-- 7. Criar policy para updates de sistema em wallets
DROP POLICY IF EXISTS "System can update wallet balances" ON public.wallets;
CREATE POLICY "System can update wallet balances"
ON public.wallets
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);