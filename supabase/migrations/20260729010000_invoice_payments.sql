-- Invoice Payments Feature — Schema Changes
-- Adds amount_paid, balance_due columns to invoices
-- Creates invoice_payments table for tracking Paychangu + manual proof payments

-- Add payment columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Set balance_due = total for existing unpaid invoices
UPDATE invoices SET balance_due = total WHERE balance_due = 0 AND status IN ('draft', 'sent', 'overdue');

-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'manual',
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paychangu_charge_id TEXT,
  proof_base64 TEXT,
  proof_filename TEXT,
  proof_content_type TEXT,
  payer_name TEXT,
  payer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_charge_idx ON invoice_payments (paychangu_charge_id) WHERE paychangu_charge_id IS NOT NULL;

-- Enable RLS
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
