-- ============================================================
-- MIGRATION 003: SaaS-generic Transactions with Profit Tracking
-- ============================================================
-- Designed for ANY business type, not just media/ads.
-- Businesses create their own categories, products, and set their own costs.
-- ============================================================

-- ============================================================
-- BUSINESS SETTINGS — configurable per business
-- ============================================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'other';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_id text;
-- Cost rate: configurable multiplier/exchange rate for cost calculations
-- e.g. media business: USD exchange rate (4300)
-- e.g. import business: cost per unit in foreign currency
-- e.g. services: not needed (set to 1)
-- The label explains what this rate means for this business
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cost_rate numeric(12,4) DEFAULT 1;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cost_rate_label text DEFAULT 'Cost Rate';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cost_rate_unit text DEFAULT '';

-- ============================================================
-- CATEGORIES — user-defined, per business
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('income', 'expense')),
  color       text,
  sort_order  int DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_categories" ON categories FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);

-- ============================================================
-- PRODUCTS — add cost column for profit tracking
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost numeric(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_unit text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ============================================================
-- TRANSACTIONS — unified income/expense log with profit tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  type            text NOT NULL CHECK (type IN ('income', 'expense')),
  -- Category (links to user-defined category, or free-text)
  category_id     uuid REFERENCES categories(id) ON DELETE SET NULL,
  category_name   text,
  -- Income: who paid you
  client_name     text,
  -- Expense: who you paid
  vendor_name     text,
  -- What this transaction is for
  description     text NOT NULL,
  -- Amount: what was paid/received
  amount          numeric(12,2) NOT NULL,
  -- Cost: what it cost you to deliver this (materials, ad spend, labor)
  -- For income: profit = amount - cost_amount
  cost_amount     numeric(12,2) DEFAULT 0,
  cost_qty        numeric(12,2) DEFAULT 0,  -- e.g. USD amount, units, hours
  profit          numeric(12,2) DEFAULT 0,
  margin          numeric(5,2) DEFAULT 0,
  -- Payment info
  payment_method  text DEFAULT 'cash',
  reference       text,
  date            date NOT NULL,
  -- Optional links
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  attachment_url  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_transactions" ON transactions FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_name);

-- ============================================================
-- AUTO-CALCULATE profit & margin on insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_transaction_profit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'income' THEN
    -- Auto-calculate cost from cost_qty × business cost_rate if cost_qty is set
    IF NEW.cost_qty IS NOT NULL AND NEW.cost_qty > 0 AND NEW.cost_amount = 0 THEN
      SELECT COALESCE(cost_rate, 1) INTO NEW.cost_amount
      FROM businesses WHERE id = NEW.business_id;
      NEW.cost_amount = NEW.cost_qty * NEW.cost_amount;
    END IF;
    -- Profit = amount - cost_amount
    NEW.profit = NEW.amount - COALESCE(NEW.cost_amount, 0);
    -- Margin percentage
    IF NEW.amount > 0 THEN
      NEW.margin = ROUND((NEW.profit / NEW.amount * 100)::numeric, 2);
    ELSE
      NEW.margin = 0;
    END IF;
  ELSE
    -- Expenses: no profit
    NEW.profit = 0;
    NEW.margin = 0;
    NEW.cost_amount = 0;
    NEW.cost_qty = 0;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_profit ON transactions;
CREATE TRIGGER trg_calculate_profit
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION calculate_transaction_profit();

-- ============================================================
-- CLIENT LEDGER VIEW — aggregated client stats
-- ============================================================
CREATE OR REPLACE VIEW client_ledger AS
SELECT
  business_id,
  client_name,
  COUNT(*) AS transaction_count,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_revenue,
  SUM(CASE WHEN type = 'income' THEN cost_amount ELSE 0 END) AS total_cost,
  SUM(CASE WHEN type = 'income' THEN profit ELSE 0 END) AS total_profit,
  SUM(CASE WHEN type = 'income' THEN cost_qty ELSE 0 END) AS total_cost_qty,
  AVG(CASE WHEN type = 'income' THEN margin ELSE NULL END) AS avg_margin,
  MAX(date) AS last_transaction_date
FROM transactions
WHERE type = 'income' AND client_name IS NOT NULL
GROUP BY business_id, client_name;

-- ============================================================
-- DAILY SUMMARY VIEW — for charts & dashboard
-- ============================================================
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  business_id,
  date,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses,
  SUM(CASE WHEN type = 'income' THEN cost_amount ELSE 0 END) AS total_cost,
  SUM(CASE WHEN type = 'income' THEN profit ELSE 0 END) AS gross_profit,
  COUNT(*) FILTER (WHERE type = 'income') AS sales_count,
  COUNT(*) FILTER (WHERE type = 'expense') AS expense_count
FROM transactions
GROUP BY business_id, date;

-- ============================================================
-- Helper: update timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
