import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const PASSWORD = encodeURIComponent("Arthur@472003Chibondo");

const MIGRATION_SQL = `
-- ============================================================
-- Products: add missing columns
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost          numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id   uuid REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_margin numeric(7,4) DEFAULT 0;

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_business_date  ON transactions(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_business_type  ON transactions(business_id, type);
CREATE INDEX IF NOT EXISTS idx_products_business_active    ON products(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_invoices_business_date      ON invoices(business_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_customers_business          ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_business         ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id         ON businesses(owner_id);

-- ============================================================
-- Platform settings (idempotent)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('pricing', '{"monthly_rate":15000,"currency":"MWK","annual_rate":150000,"trial_days":14,"features":["Unlimited invoices","Unlimited businesses","Profit tracking","Team members","Reports & exports","Priority support"]}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS policies (idempotent)
-- ============================================================
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_platform_settings" ON platform_settings;
CREATE POLICY "read_platform_settings" ON platform_settings FOR SELECT USING (auth.uid() IS NOT NULL);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_businesses" ON businesses;
CREATE POLICY "owner_businesses" ON businesses FOR ALL USING (auth.uid() = owner_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_transactions" ON transactions;
CREATE POLICY "owner_transactions" ON transactions FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_products" ON products;
CREATE POLICY "owner_products" ON products FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_categories" ON categories;
CREATE POLICY "owner_categories" ON categories FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_customers" ON customers;
CREATE POLICY "owner_customers" ON customers FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_invoices" ON invoices;
CREATE POLICY "owner_invoices" ON invoices FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
`;

export async function POST() {
  const pg = await import("pg");
  const Client = pg.Client;

  const connStr = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
  const client = new (Client as any)({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    await client.query(MIGRATION_SQL);

    // Verify products columns
    const { rows: cols } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position"
    );
    const { rows: idxRows } = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('transactions','products','invoices','customers','categories','businesses') ORDER BY tablename, indexname"
    );
    await client.end();

    return NextResponse.json({
      success: true,
      message: "Migration complete — products columns & indexes added",
      products_columns: cols.map((r: any) => r.column_name),
      indexes: idxRows.map((r: any) => r.indexname),
    });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
