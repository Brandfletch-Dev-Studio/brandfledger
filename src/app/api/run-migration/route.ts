import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const PASSWORD = encodeURIComponent("Arthur@472003Chibondo");

const MIGRATION_SQL = `
-- Create platform_settings table if not exists
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default pricing
INSERT INTO platform_settings (key, value) VALUES
  ('pricing', '{"monthly_rate": 15000, "currency": "MWK", "annual_rate": 150000, "trial_days": 14, "features": ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"]}')
ON CONFLICT (key) DO NOTHING;

-- Add owner_id to businesses if not exists
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

-- Enable RLS on platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON platform_settings;
CREATE POLICY "Authenticated users can read platform settings" ON platform_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Enable RLS on businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
CREATE POLICY "Users can view own businesses" ON businesses
  FOR SELECT USING (auth.uid() = owner_id OR owner_id IS NULL);
DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
CREATE POLICY "Users can insert own businesses" ON businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
CREATE POLICY "Users can update own businesses" ON businesses
  FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Users can delete own businesses" ON businesses;
CREATE POLICY "Users can delete own businesses" ON businesses
  FOR DELETE USING (auth.uid() = owner_id);

-- Enable RLS on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own transactions" ON transactions;
CREATE POLICY "Users can manage own transactions" ON transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = transactions.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on products (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own products" ON products;
    CREATE POLICY "Users can manage own products" ON products
      FOR ALL USING (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Enable RLS on categories (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
    CREATE POLICY "Users can manage own categories" ON categories
      FOR ALL USING (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Enable RLS on invoices (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
    CREATE POLICY "Users can manage own invoices" ON invoices
      FOR ALL USING (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Enable RLS on customers (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
    CREATE POLICY "Users can manage own customers" ON customers
      FOR ALL USING (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Enable RLS on team_members (only if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can manage own team" ON team_members;
    CREATE POLICY "Users can manage own team" ON team_members
      FOR ALL USING (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
      );
  END IF;
END $$;
`;

export async function POST() {
  const pg = await import("pg");
  const Client = pg.Client;

  // eu-west-1 is the correct region
  const connStr = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
  const client = new (Client as any)({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("Connected via eu-west-1 pooler");
    
    await client.query(MIGRATION_SQL);
    
    // Verify
    const { rows } = await client.query("SELECT key FROM platform_settings");
    const { rows: bizRows } = await client.query("SELECT id, name, owner_id FROM businesses LIMIT 5");
    const { rows: tableList } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    await client.end();

    return NextResponse.json({
      success: true,
      message: "Migration complete",
      platformSettings: rows.map((r: any) => r.key),
      businesses: bizRows,
      tables: tableList.map((r: any) => r.table_name),
    });
  } catch (err: any) {
    console.log("Migration failed:", err.message);
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
