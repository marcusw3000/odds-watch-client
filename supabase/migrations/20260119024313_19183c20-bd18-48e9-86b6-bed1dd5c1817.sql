-- Drop and recreate constraint with new value
ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_ref_type_check;

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_ref_type_check 
CHECK (ref_type = ANY (ARRAY['DEPOSIT'::text, 'WITHDRAW'::text, 'TRADE'::text, 'SETTLEMENT'::text, 'FEE'::text, 'ADJUSTMENT'::text, 'COPY_SUBSCRIPTION'::text]));