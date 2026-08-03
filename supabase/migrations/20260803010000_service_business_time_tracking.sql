-- ============================================================
-- SERVICE BUSINESS: Time Tracking & WIP Management
-- ============================================================

-- Time entries: track billable hours per client
CREATE TABLE IF NOT EXISTS time_entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  description   text,
  hours         numeric(8,2) NOT NULL DEFAULT 0,
  hourly_rate   numeric(12,2) DEFAULT 0,     -- billing rate per hour
  billable       boolean DEFAULT true,
  billed        boolean DEFAULT false,       -- true once included in an invoice
  invoice_id    uuid REFERENCES invoices(id) ON DELETE SET NULL,
  work_date     date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_time_entries" ON time_entries FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_time_entries_business ON time_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_customer ON time_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_unbilled ON time_entries(business_id) WHERE billed = false;

-- Add service-specific fields to products table
-- (service products can have estimated_hours and is_service flag)
ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_hours numeric(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service boolean DEFAULT false;

-- RPC: Log a time entry
CREATE OR REPLACE FUNCTION log_time_entry(
  p_business_id uuid,
  p_customer_name text,
  p_description text DEFAULT NULL,
  p_hours numeric DEFAULT 0,
  p_hourly_rate numeric DEFAULT 0,
  p_billable boolean DEFAULT true,
  p_work_date date DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_customer_id uuid;
  v_entry_id uuid;
BEGIN
  -- Resolve or create customer
  SELECT id INTO v_customer_id FROM customers
  WHERE business_id = p_business_id AND LOWER(TRIM(name)) = LOWER(TRIM(p_customer_name))
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (business_id, name, total_invoiced)
    VALUES (p_business_id, p_customer_name, 0)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO time_entries (
    business_id, customer_id, customer_name, description,
    hours, hourly_rate, billable, work_date
  ) VALUES (
    p_business_id, v_customer_id, p_customer_name, p_description,
    p_hours, p_hourly_rate, p_billable, COALESCE(p_work_date, CURRENT_DATE)
  )
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'customer_name', p_customer_name,
    'hours', p_hours,
    'hourly_rate', p_hourly_rate,
    'billable_amount', p_hours * p_hourly_rate,
    'work_date', COALESCE(p_work_date, CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get WIP (unbilled time) per client
CREATE OR REPLACE FUNCTION get_wip_summary(
  p_business_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'customer_name', t.customer_name,
    'total_hours', t.total_hours,
    'billable_hours', t.billable_hours,
    'unbilled_amount', t.unbilled_amount,
    'entry_count', t.entry_count,
    'last_work_date', t.last_work_date
  )) INTO v_result
  FROM (
    SELECT
      customer_name,
      SUM(hours) AS total_hours,
      SUM(CASE WHEN billable THEN hours ELSE 0 END) AS billable_hours,
      SUM(CASE WHEN billable AND NOT billed THEN hours * hourly_rate ELSE 0 END) AS unbilled_amount,
      COUNT(*) AS entry_count,
      MAX(work_date) AS last_work_date
    FROM time_entries
    WHERE business_id = p_business_id AND billed = false
    GROUP BY customer_name
    ORDER BY unbilled_amount DESC
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get client profitability (aggregates transactions + time entries)
CREATE OR REPLACE FUNCTION get_client_profitability(
  p_business_id uuid,
  p_customer_name text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'customer_name', t.customer_name,
    'total_revenue', t.total_revenue,
    'total_cost', t.total_cost,
    'total_profit', t.total_profit,
    'profit_margin', CASE WHEN t.total_revenue > 0 THEN round((t.total_profit / t.total_revenue * 100)::numeric, 1) ELSE 0 END,
    'outstanding', t.outstanding,
    'hours_worked', t.hours_worked,
    'effective_rate', CASE WHEN t.hours_worked > 0 THEN round((t.total_revenue / t.hours_worked)::numeric, 0) ELSE 0 END,
    'unbilled_wip', t.unbilled_wip
  )) INTO v_result
  FROM (
    SELECT
      c.name AS customer_name,
      COALESCE(SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN tr.type = 'income' THEN COALESCE(tr.cost_amount, 0) ELSE 0 END), 0) AS total_cost,
      COALESCE(SUM(CASE WHEN tr.type = 'income' THEN tr.amount - COALESCE(tr.cost_amount, 0) ELSE 0 END), 0) AS total_profit,
      COALESCE(c.total_invoiced, 0) - COALESCE((
        SELECT SUM(amount) FROM transactions WHERE business_id = p_business_id
        AND client_name = c.name AND type = 'income'
        AND description ILIKE '%payment%'
      ), 0) AS outstanding,
      COALESCE((
        SELECT SUM(hours) FROM time_entries WHERE business_id = p_business_id AND customer_name = c.name
      ), 0) AS hours_worked,
      COALESCE((
        SELECT SUM(CASE WHEN billable AND NOT billed THEN hours * hourly_rate ELSE 0 END)
        FROM time_entries WHERE business_id = p_business_id AND customer_name = c.name
      ), 0) AS unbilled_wip
    FROM customers c
    LEFT JOIN transactions tr ON tr.business_id = p_business_id AND tr.client_name = c.name
    WHERE c.business_id = p_business_id
    AND (p_customer_name IS NULL OR LOWER(TRIM(c.name)) = LOWER(TRIM(p_customer_name)))
    GROUP BY c.name, c.total_invoiced
    ORDER BY total_revenue DESC
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
