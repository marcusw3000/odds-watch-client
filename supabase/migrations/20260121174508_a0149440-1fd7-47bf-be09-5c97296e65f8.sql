-- Remove foreign keys duplicadas que causam erro PGRST201
-- Mantém apenas as FKs com nomenclatura padrão do Supabase (*_fkey)

-- 1. comments.market_id
ALTER TABLE public.comments 
  DROP CONSTRAINT IF EXISTS fk_comments_market;

-- 2. ledger_entries.wallet_id  
ALTER TABLE public.ledger_entries 
  DROP CONSTRAINT IF EXISTS fk_ledger_entries_wallet;

-- 3. market_options.market_id
ALTER TABLE public.market_options 
  DROP CONSTRAINT IF EXISTS fk_market_options_market;

-- 4. market_settlements.market_id
ALTER TABLE public.market_settlements 
  DROP CONSTRAINT IF EXISTS fk_market_settlements_market;

-- 5. notifications.user_id
ALTER TABLE public.notifications 
  DROP CONSTRAINT IF EXISTS fk_notifications_user;

-- 6. transactions.market_id
ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS fk_transactions_market;

-- 7. user_contracts.user_id
ALTER TABLE public.user_contracts 
  DROP CONSTRAINT IF EXISTS fk_user_contracts_user;

-- 8. user_favorites.market_id
ALTER TABLE public.user_favorites 
  DROP CONSTRAINT IF EXISTS fk_user_favorites_market;

-- 9. user_favorites.user_id
ALTER TABLE public.user_favorites 
  DROP CONSTRAINT IF EXISTS fk_user_favorites_user;