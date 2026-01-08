-- Add new settlement types to the enum
ALTER TYPE settlement_type ADD VALUE IF NOT EXISTS 'PTAX_USD';
ALTER TYPE settlement_type ADD VALUE IF NOT EXISTS 'PTAX_EUR';
ALTER TYPE settlement_type ADD VALUE IF NOT EXISTS 'IPCA_12M';
ALTER TYPE settlement_type ADD VALUE IF NOT EXISTS 'PIB';