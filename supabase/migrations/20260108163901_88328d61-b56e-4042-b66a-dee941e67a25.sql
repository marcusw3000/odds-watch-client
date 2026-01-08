-- Corrigir search_path da função handle_new_user_balance
CREATE OR REPLACE FUNCTION public.handle_new_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_balances (user_id, balance, total_deposited)
  VALUES (NEW.id, 1000, 1000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;