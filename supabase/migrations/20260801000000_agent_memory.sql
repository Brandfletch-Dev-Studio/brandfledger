-- Agent Memory & Custom Instructions
-- Created: 2026-08-01

-- 1. Add custom_instructions column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS custom_instructions TEXT DEFAULT '';

-- 2. Create agent_memories table
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_memories_business_id ON agent_memories(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_business_category ON agent_memories(business_id, category);

-- 4. RLS
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Policy: Only business members can read/write their business's memories
CREATE POLICY "Business members can read agent memories"
  ON agent_memories FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can insert agent memories"
  ON agent_memories FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can update agent memories"
  ON agent_memories FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business members can delete agent memories"
  ON agent_memories FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );
