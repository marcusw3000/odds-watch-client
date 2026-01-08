-- Create trigger to automatically create user balance when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_balance();

-- Insert balance for existing users who don't have one yet
INSERT INTO public.user_balances (user_id, balance, total_deposited)
SELECT id, 1000, 1000 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_balances);