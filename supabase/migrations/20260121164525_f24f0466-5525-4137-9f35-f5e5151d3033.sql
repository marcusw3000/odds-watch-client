-- Remove duplicate foreign key on user_contracts.market_id
-- Keep fk_user_contracts_market (RESTRICT) and remove user_contracts_market_id_fkey (CASCADE)
-- Then rename to maintain naming convention

-- 1. Drop the original CASCADE constraint (dangerous behavior)
ALTER TABLE user_contracts 
DROP CONSTRAINT IF EXISTS user_contracts_market_id_fkey;

-- 2. Rename the safer RESTRICT constraint to standard naming
ALTER TABLE user_contracts 
RENAME CONSTRAINT fk_user_contracts_market 
TO user_contracts_market_id_fkey;