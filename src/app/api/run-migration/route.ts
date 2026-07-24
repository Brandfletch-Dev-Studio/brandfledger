import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// This route runs raw SQL migrations using the pg library
// It's a one-time setup tool — disable after use

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

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
`;

export async function POST() {
  if (!DB_URL) {
    return NextResponse.json({ 
      error: "DATABASE_URL not set. Add it to Vercel env vars.",
      hint: "Go to Supabase Dashboard → Settings → Database → Connection string (URI) and add as DATABASE_URL"
    }, { status: 500 });
  }

  try {
    // Dynamic import pg
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    await client.query(MIGRATION_SQL);
    
    // Verify
    const { rows } = await client.query("SELECT key FROM platform_settings");
    await client.end();

    return NextResponse.json({ 
      success: true, 
      message: "Migration complete",
      tables: rows.map(r => r.key),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
