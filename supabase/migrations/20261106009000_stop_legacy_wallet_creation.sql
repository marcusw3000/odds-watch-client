-- Preserve historical BRL accounting; new accounts use the paper wallet lazily.
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
