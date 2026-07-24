import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const PASSWORD = encodeURIComponent("Arthur@472003Chibondo");
const POOLER_REGIONS = [
  "eu-central-1", "us-east-1", "eu-west-1", "ap-southeast-1",
  "ap-northeast-1", "us-west-1", "sa-east-1", "ap-south-1",
];

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

-- Enable RLS on businesses if not already
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Businesses policies
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

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own products" ON products;
CREATE POLICY "Users can manage own products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = categories.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
CREATE POLICY "Users can manage own invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = invoices.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
CREATE POLICY "Users can manage own customers" ON customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.owner_id = auth.uid())
  );

-- Enable RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own team" ON team_members;
CREATE POLICY "Users can manage own team" ON team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = team_members.business_id AND businesses.owner_id = auth.uid())
  );
`;

export async function POST() {
  const { Client } = await import("pg");

  // Try each pooler region until one works
  for (const region of POOLER_REGIONS) {
    const connStr = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      console.log(`Connected via pooler region: ${region}`);
      
      await client.query(MIGRATION_SQL);
      
      // Verify
      const { rows } = await client.query("SELECT key FROM platform_settings");
      const { rows: bizRows } = await client.query("SELECT id, name, owner_id FROM businesses LIMIT 5");
      await client.end();

      return NextResponse.json({
        success: true,
        region,
        message: "Migration complete",
        platformSettings: rows.map((r: any) => r.key),
        businesses: bizRows,
      });
    } catch (err: any) {
      console.log(`Pooler ${region} failed:`, err.message);
      try { await client.end(); } catch {}
      // Continue to next region
      if (err.code === "ENOTFOUND" || err.message.includes("tenant") || err.message.includes("not found")) {
        continue;
      }
      // For other errors, also try next region
      continue;
    }
  }

  return NextResponse.json({
    error: "Could not connect to database via any pooler region",
    tried: POOLER_REGIONS,
  }, { status: 500 });
}
