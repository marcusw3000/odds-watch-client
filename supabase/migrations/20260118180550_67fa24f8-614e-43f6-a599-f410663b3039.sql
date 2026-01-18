-- Fix function search_path security warnings
CREATE OR REPLACE FUNCTION public.update_copy_trader_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_copy_trader_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.copy_traders 
    SET total_followers = total_followers + 1
    WHERE id = NEW.trader_id AND NEW.status = 'ACTIVE';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'ACTIVE' AND NEW.status != 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = GREATEST(0, total_followers - 1)
      WHERE id = NEW.trader_id;
    ELSIF OLD.status != 'ACTIVE' AND NEW.status = 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = total_followers + 1
      WHERE id = NEW.trader_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'ACTIVE' THEN
      UPDATE public.copy_traders 
      SET total_followers = GREATEST(0, total_followers - 1)
      WHERE id = OLD.trader_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_profile_copy_trader_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET 
      is_copy_trader = (NEW.status = 'APPROVED'),
      copy_trader_id = CASE WHEN NEW.status = 'APPROVED' THEN NEW.id ELSE NULL END
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;