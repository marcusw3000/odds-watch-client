-- Drop the old unique index that doesn't include contract_type
DROP INDEX IF EXISTS idx_user_contracts_unique_position;

-- Create a new unique index that includes contract_type
-- This allows users to have both YES and NO contracts on the same option
CREATE UNIQUE INDEX idx_user_contracts_unique_position 
ON user_contracts (user_id, market_id, COALESCE(option_id::text, position), contract_type);