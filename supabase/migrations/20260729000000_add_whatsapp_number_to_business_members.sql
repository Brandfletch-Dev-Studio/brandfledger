-- Add whatsapp_number column to business_members
-- Used by the WhatsApp Finance Manager to map incoming WhatsApp messages to a business

-- Add the column
ALTER TABLE business_members
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Create index for fast lookups by WhatsApp number (the webhook resolves users this way)
CREATE INDEX IF NOT EXISTS business_members_whatsapp_number_idx
  ON business_members (whatsapp_number)
  WHERE whatsapp_number IS NOT NULL;

-- Also ensure the conversation context table exists (in case the earlier migration wasn't applied)
CREATE TABLE IF NOT EXISTS whatsapp_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  recent_customers JSONB DEFAULT '[]'::jsonb,
  recent_invoices JSONB DEFAULT '[]'::jsonb,
  recent_amounts JSONB DEFAULT '[]'::jsonb,
  last_subject_type TEXT,
  last_subject_name TEXT,
  last_subject_entity TEXT,
  last_amount NUMERIC DEFAULT 0,
  pending_action TEXT,
  pending_action_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, whatsapp_number)
);

CREATE INDEX IF NOT EXISTS whatsapp_context_number_idx
  ON whatsapp_conversation_context (whatsapp_number);

ALTER TABLE whatsapp_conversation_context ENABLE ROW LEVEL SECURITY;
