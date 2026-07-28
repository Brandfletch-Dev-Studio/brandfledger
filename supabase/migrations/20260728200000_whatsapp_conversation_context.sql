-- WhatsApp Finance Manager — Conversation Context Table
-- Stores per-user conversation state for the WhatsApp AI Finance Manager
-- Enables pronoun resolution, multi-turn confirm flows, and pending action tracking

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

-- Index for fast lookups by WhatsApp number
CREATE INDEX IF NOT EXISTS whatsapp_context_number_idx
  ON whatsapp_conversation_context (whatsapp_number);

-- Enable RLS
ALTER TABLE whatsapp_conversation_context ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by the webhook handler)
