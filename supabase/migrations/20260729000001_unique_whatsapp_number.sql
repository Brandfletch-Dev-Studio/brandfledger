-- Enforce one WhatsApp number per business member (unique, non-null only)
-- Allows multiple NULL values (members who haven't linked WhatsApp yet)
-- but prevents the same number being linked to two different businesses

-- Drop the non-unique index if it exists, replace with a unique one
DROP INDEX IF EXISTS business_members_whatsapp_number_idx;
CREATE UNIQUE INDEX IF NOT EXISTS business_members_whatsapp_number_unique
  ON business_members (whatsapp_number)
  WHERE whatsapp_number IS NOT NULL;
