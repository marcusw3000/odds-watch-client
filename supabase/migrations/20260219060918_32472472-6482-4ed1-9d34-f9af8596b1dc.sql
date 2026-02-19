-- 1. Trigger para proteger campos sensíveis em copy_subscriptions
CREATE OR REPLACE FUNCTION protect_copy_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Follower só pode alterar configurações de cópia (auto_copy, max_trade_amount, copy_percentage)
  NEW.status := OLD.status;
  NEW.cancelled_at := OLD.cancelled_at;
  NEW.total_trades_copied := OLD.total_trades_copied;
  NEW.total_profit := OLD.total_profit;
  NEW.total_commission_paid := OLD.total_commission_paid;
  NEW.monthly_fee_paid := OLD.monthly_fee_paid;
  NEW.last_payment_at := OLD.last_payment_at;
  NEW.current_period_start := OLD.current_period_start;
  NEW.current_period_end := OLD.current_period_end;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.payment_method := OLD.payment_method;
  NEW.trader_id := OLD.trader_id;
  NEW.follower_id := OLD.follower_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_copy_subscription_fields_trigger
  BEFORE UPDATE ON copy_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION protect_copy_subscription_fields();

-- 2. Revogar grants de escrita em referral_settings (defesa em profundidade)
REVOKE INSERT, UPDATE, DELETE ON public.referral_settings
  FROM anon, authenticated;