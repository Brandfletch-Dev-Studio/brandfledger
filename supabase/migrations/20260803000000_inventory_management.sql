-- ============================================================
-- INVENTORY MANAGEMENT — stock tracking for product-based businesses
-- ============================================================

-- Add stock columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_unit text DEFAULT 'units';

-- Track stock movements (purchases, sales, adjustments, losses)
CREATE TABLE IF NOT EXISTS stock_movements (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  product_id    uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'loss', 'return')),
  quantity      numeric(12,2) NOT NULL,  -- positive = stock in, negative = stock out
  unit_cost     numeric(12,2) DEFAULT 0, -- cost per unit at time of movement (for purchases)
  note          text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  created_by    uuid
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_stock_movements" ON stock_movements FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stock_movements(business_id);

-- Atomic stock decrement RPC (called when a transaction sells a product)
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_transaction_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Decrement stock atomically
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE id = p_product_id;

  -- Log the movement
  INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, transaction_id)
  SELECT business_id, p_product_id, 'sale', -p_quantity, p_transaction_id
  FROM products WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic stock increment RPC (for purchases/restocking)
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric DEFAULT 0,
  p_note text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Increment stock atomically
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      cost = CASE WHEN p_unit_cost > 0 THEN p_unit_cost ELSE cost END,
      updated_at = now()
  WHERE id = p_product_id;

  -- Log the movement
  INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, unit_cost, note)
  SELECT business_id, p_product_id, 'purchase', p_quantity, p_unit_cost, p_note
  FROM products WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stock adjustment RPC (for stock takes, damages, losses)
CREATE OR REPLACE FUNCTION adjust_product_stock(
  p_product_id uuid,
  p_new_quantity numeric,
  p_note text DEFAULT NULL,
  p_movement_type text DEFAULT 'adjustment'
) RETURNS void AS $$
DECLARE
  v_old_quantity numeric;
  v_diff numeric;
BEGIN
  SELECT stock_quantity INTO v_old_quantity FROM products WHERE id = p_product_id;
  v_diff := p_new_quantity - COALESCE(v_old_quantity, 0);

  UPDATE products SET stock_quantity = p_new_quantity, updated_at = now()
  WHERE id = p_product_id;

  IF v_diff != 0 THEN
    INSERT INTO stock_movements (business_id, product_id, movement_type, quantity, note)
    SELECT business_id, p_product_id, p_movement_type, v_diff, p_note
    FROM products WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
