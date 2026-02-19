
-- Funcao 1: Proteger campos do perfil contra manipulacao via DevTools
CREATE OR REPLACE FUNCTION protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypassa completamente
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins podem editar tudo
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Usuario comum: resetar campos protegidos ao valor original
  -- Moderacao
  NEW.is_blocked := OLD.is_blocked;
  NEW.blocked_at := OLD.blocked_at;
  NEW.blocked_by := OLD.blocked_by;
  NEW.blocked_reason := OLD.blocked_reason;
  -- Copy Trade
  NEW.is_copy_trader := OLD.is_copy_trader;
  NEW.copy_trader_id := OLD.copy_trader_id;
  -- Estatisticas
  NEW.total_trades := OLD.total_trades;
  NEW.winning_trades := OLD.winning_trades;
  NEW.total_profit := OLD.total_profit;
  NEW.total_volume := OLD.total_volume;
  NEW.roi_percent := OLD.roi_percent;
  NEW.current_streak := OLD.current_streak;
  NEW.best_streak := OLD.best_streak;
  NEW.best_trade_profit := OLD.best_trade_profit;
  NEW.markets_won_streak := OLD.markets_won_streak;
  NEW.best_markets_won_streak := OLD.best_markets_won_streak;
  NEW.weekend_trades := OLD.weekend_trades;
  -- Conquistas
  NEW.has_night_trade := OLD.has_night_trade;
  NEW.has_early_trade := OLD.has_early_trade;
  NEW.has_speed_trade := OLD.has_speed_trade;
  NEW.has_contrarian_trade := OLD.has_contrarian_trade;
  -- Referrals
  NEW.total_referrals := OLD.total_referrals;
  NEW.activated_referrals := OLD.activated_referrals;
  NEW.total_referral_commission := OLD.total_referral_commission;
  -- Sugestoes
  NEW.suggestions_created := OLD.suggestions_created;
  NEW.suggestions_approved := OLD.suggestions_approved;
  NEW.suggestions_implemented := OLD.suggestions_implemented;
  NEW.best_suggestion_score := OLD.best_suggestion_score;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_fields_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_fields();

-- Funcao 2: Proteger campos administrativos do copy_traders
CREATE OR REPLACE FUNCTION protect_copy_trader_fields()
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

  -- Trader nao pode alterar campos administrativos
  NEW.status := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.suspended_at := OLD.suspended_at;
  NEW.custom_trader_split := OLD.custom_trader_split;
  NEW.custom_platform_split := OLD.custom_platform_split;
  NEW.total_followers := OLD.total_followers;
  NEW.total_trades_copied := OLD.total_trades_copied;
  NEW.total_earnings := OLD.total_earnings;
  NEW.win_rate := OLD.win_rate;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_copy_trader_fields_trigger
  BEFORE UPDATE ON copy_traders
  FOR EACH ROW
  EXECUTE FUNCTION protect_copy_trader_fields();
