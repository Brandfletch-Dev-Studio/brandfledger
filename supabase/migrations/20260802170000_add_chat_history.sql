-- Add chat_history column to whatsapp_conversation_context
-- Stores recent conversation messages (user + assistant) for context-aware responses
ALTER TABLE whatsapp_conversation_context 
  ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;
