-- Add business-level Paychangu config and payment methods
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS paychangu_secret_key text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS paychangu_public_key text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb;
