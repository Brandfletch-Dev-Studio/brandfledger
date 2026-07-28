-- Migration: Fix customer unique constraint, team_members/business_members mismatch, and RPC functions
-- Date: 2026-07-28

-- ============================================================
-- 1. Unique constraint on customers(business_id, name) — prevents duplicate customers
-- ============================================================

-- First, remove existing duplicates by keeping the oldest one and merging data
DO $$
BEGIN
  -- Merge duplicates: keep the one with the lowest created_at, sum total_invoiced
  WITH duplicates AS (
    SELECT id, business_id, name,
      ROW_NUMBER() OVER (PARTITION BY business_id, LOWER(TRIM(name)) ORDER BY created_at ASC) as rn,
      SUM(total_invoiced) OVER (PARTITION BY business_id, LOWER(TRIM(name))) as merged_total
    FROM customers
  ),
  to_keep AS (
    SELECT id, merged_total FROM duplicates WHERE rn = 1
  ),
  to_delete AS (
    SELECT id FROM duplicates WHERE rn > 1
  )
  -- Update invoices pointing to duplicate customers to point to the kept one
  UPDATE invoices
  SET customer_id = (SELECT id FROM to_keep WHERE to_keep.id != invoices.customer_id LIMIT 1)
  WHERE customer_id IN (SELECT id FROM to_delete)
  AND EXISTS (SELECT 1 FROM to_keep);
  
  -- Update total_invoiced on the kept customer
  UPDATE customers
  SET total_invoiced = (SELECT merged_total FROM to_keep WHERE to_keep.id = customers.id)
  WHERE id IN (SELECT id FROM to_keep);
  
  -- Delete duplicates
  DELETE FROM customers WHERE id IN (SELECT id FROM to_delete);
END $$;

-- Add the unique constraint (case-insensitive, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_name_unique
  ON customers (business_id, LOWER(TRIM(name)));

-- ============================================================
-- 2. Fix team_members / business_members naming mismatch
-- ============================================================

-- The RLS migration (20260724000004) references "team_members" but the initial
-- schema (001) creates "business_members". Create a view alias so both work,
-- or rename the table. We'll create a view to avoid breaking existing code.

CREATE OR REPLACE VIEW team_members AS
  SELECT * FROM business_members;

-- ============================================================
-- 3. Create atomic RPC functions for customer total_invoiced management
-- ============================================================

-- upsert_customer_and_increment: atomically creates customer if not exists,
-- and increments total_invoiced. Eliminates race conditions.
CREATE OR REPLACE FUNCTION upsert_customer_and_increment(
  p_business_id UUID,
  p_name TEXT,
  p_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Try to insert, on conflict (business_id, lower(trim(name))) do nothing
  INSERT INTO customers (business_id, name, total_invoiced, created_at, updated_at)
  VALUES (p_business_id, TRIM(p_name), p_amount, NOW(), NOW())
  ON CONFLICT (business_id, LOWER(TRIM(name))) DO NOTHING
  RETURNING id INTO v_customer_id;
  
  -- If insert was skipped (conflict), fetch existing and increment
  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE business_id = p_business_id AND LOWER(TRIM(name)) = LOWER(TRIM(p_name))
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      UPDATE customers
      SET total_invoiced = COALESCE(total_invoiced, 0) + p_amount,
          updated_at = NOW()
      WHERE id = v_customer_id;
    END IF;
  END IF;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- decrement_customer_total: atomically decrements total_invoiced by name lookup
CREATE OR REPLACE FUNCTION decrement_customer_total(
  p_business_id UUID,
  p_name TEXT,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET total_invoiced = GREATEST(0, COALESCE(total_invoiced, 0) - p_amount),
      updated_at = NOW()
  WHERE business_id = p_business_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(p_name));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- decrement_customer_total_by_id: atomically decrements total_invoiced by customer ID
CREATE OR REPLACE FUNCTION decrement_customer_total_by_id(
  p_customer_id UUID,
  p_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET total_invoiced = GREATEST(0, COALESCE(total_invoiced, 0) - p_amount),
      updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_customer_and_increment TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION decrement_customer_total TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION decrement_customer_total_by_id TO authenticated, anon, service_role;
