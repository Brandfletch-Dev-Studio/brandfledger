import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const DB_PASSWORD = encodeURIComponent("Arthur@472003Chibondo");

export async function POST() {
  const pg = await import("pg");
  const Client = pg.Client;

  const connStr = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
  const client = new (Client as any)({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    
    // Get the user ID for geniuspulse22@gmail.com
    const { rows: users } = await client.query("SELECT id FROM auth.users WHERE email = 'geniuspulse22@gmail.com'");
    const userId = users[0]?.id;
    
    if (!userId) {
      await client.end();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Link all existing businesses to this user (that don't have an owner_id)
    const { rowCount } = await client.query(
      "UPDATE businesses SET owner_id = $1 WHERE owner_id IS NULL RETURNING id, name",
      [userId]
    );
    
    // Also run the full migration (platform_settings, RLS, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      
      INSERT INTO platform_settings (key, value) VALUES
        ('pricing', '{"monthly_rate": 15000, "currency": "MWK", "annual_rate": 150000, "trial_days": 14, "features": ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"]}')
      ON CONFLICT (key) DO NOTHING;
    `);
    
    const { rows: businesses } = await client.query("SELECT id, name, owner_id FROM businesses");
    const { rows: settings } = await client.query("SELECT key FROM platform_settings");
    
    await client.end();

    return NextResponse.json({
      success: true,
      userId,
      linkedBusinesses: rowCount,
      businesses,
      platformSettings: settings.map((r: any) => r.key),
    });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
