-- ============================================================
-- MIGRATION 003: Transactions with Profit Tracking
-- Adds a unified transactions table for quick-logging income &
-- expenses with automatic profit calculation per sale.
-- ============================================================

-- Add exchange rate & ad pricing config to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS usd_exchange_rate numeric(10,2) DEFAULT 4300;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_ad_rate numeric(10,2) DEFAULT 6000;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'media';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tax_id text;

-- ============================================================
-- TRANSACTIONS — unified income/expense log with profit tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  type            text NOT NULL CHECK (type IN ('income', 'expense')),
  category        text NOT NULL DEFAULT 'other',
  -- Income fields
  client_name     text,
  -- Description / notes
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  -- Ad spend tracking (income only)
  ad_usd          numeric(10,2) DEFAULT 0,
  ad_cost         numeric(12,2) DEFAULT 0,
  profit          numeric(12,2) DEFAULT 0,
  margin          numeric(5,2) DEFAULT 0,
  -- Payment info
  payment_method  text DEFAULT 'cash',
  reference       text,
  date            date NOT NULL,
  -- Link to invoice (optional)
  invoice_id      uuid REFERENCES invoices(id) ON DELETE SET NULL,
  -- Receipt/attachment
  attachment_url  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_transactions" ON transactions FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_name);

-- ============================================================
-- AUTO-CALCULATE profit & margin on insert/update
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_transaction_profit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'income' THEN
    -- ad_cost = ad_usd * business exchange rate
    NEW.ad_cost = COALESCE(NEW.ad_usd, 0) * (
      SELECT COALESCE(usd_exchange_rate, 4300) FROM businesses WHERE id = NEW.business_id
    );
    -- profit = amount - ad_cost
    NEW.profit = NEW.amount - NEW.ad_cost;
    -- margin percentage
    IF NEW.amount > 0 THEN
      NEW.margin = ROUND((NEW.profit / NEW.amount * 100)::numeric, 2);
    ELSE
      NEW.margin = 0;
    END IF;
  ELSE
    -- Expenses have no profit
    NEW.profit = 0;
    NEW.margin = 0;
    NEW.ad_cost = 0;
    NEW.ad_usd = 0;
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
-- Updated updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CLIENT LEDGER VIEW — aggregated client stats
-- ============================================================
CREATE OR REPLACE VIEW client_ledger AS
SELECT
  business_id,
  client_name,
  COUNT(*) AS transaction_count,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_paid,
  SUM(CASE WHEN type = 'income' THEN ad_cost ELSE 0 END) AS total_ad_cost,
  SUM(CASE WHEN type = 'income' THEN profit ELSE 0 END) AS total_profit,
  SUM(CASE WHEN type = 'income' THEN ad_usd ELSE 0 END) AS total_usd,
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
  SUM(CASE WHEN type = 'income' THEN ad_cost ELSE 0 END) AS ad_cost,
  SUM(CASE WHEN type = 'income' THEN profit ELSE 0 END) AS gross_profit,
  SUM(profit) AS net_profit,
  COUNT(*) FILTER (WHERE type = 'income') AS sales_count,
  COUNT(*) FILTER (WHERE type = 'expense') AS expense_count
FROM transactions
GROUP BY business_id, date;
