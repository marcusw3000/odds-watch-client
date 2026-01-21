-- =============================================
-- DATABASE INTEGRITY FIX MIGRATION
-- =============================================

-- 1. Remove orphan wallet (user no longer exists)
DELETE FROM wallets 
WHERE id = '66c661b1-f065-47fc-bce2-dc57d07a22b5'
  AND user_id = '56e53172-c681-401d-8970-17adee4c4626';

-- 2. Create missing settlement records for already settled markets
INSERT INTO market_settlements (market_id, result, source, is_automatic, settled_by, settled_at)
SELECT 
  m.id,
  m.result,
  'RETROACTIVE_FIX',
  false,
  m.settled_by,
  COALESCE(m.updated_at, now())
FROM markets m
WHERE m.status = 'SETTLED'
  AND m.result IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM market_settlements ms WHERE ms.market_id = m.id);

-- 3. Add foreign key constraints to prevent future orphans

-- Wallets must reference a valid profile
ALTER TABLE wallets 
ADD CONSTRAINT fk_wallets_profile 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Transactions must reference valid markets
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT;

-- User contracts must reference valid markets
ALTER TABLE user_contracts 
ADD CONSTRAINT fk_user_contracts_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT;

-- User contracts must reference valid users (profiles)
ALTER TABLE user_contracts 
ADD CONSTRAINT fk_user_contracts_user 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Market settlements must reference valid markets
ALTER TABLE market_settlements 
ADD CONSTRAINT fk_market_settlements_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE;

-- Market options must reference valid markets
ALTER TABLE market_options 
ADD CONSTRAINT fk_market_options_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE;

-- Comments must reference valid markets
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE;

-- Comments must reference valid users
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_user 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Notifications must reference valid users
ALTER TABLE notifications 
ADD CONSTRAINT fk_notifications_user 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ledger entries wallet reference
ALTER TABLE ledger_entries 
ADD CONSTRAINT fk_ledger_entries_wallet 
FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL;

-- User favorites must reference valid markets and users
ALTER TABLE user_favorites 
ADD CONSTRAINT fk_user_favorites_market 
FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE;

ALTER TABLE user_favorites 
ADD CONSTRAINT fk_user_favorites_user 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;