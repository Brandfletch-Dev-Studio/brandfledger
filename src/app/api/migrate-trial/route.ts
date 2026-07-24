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

    // 1. Add subscription columns to businesses
    await client.query(`
      ALTER TABLE businesses 
      ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS paychangu_customer_id TEXT;
    `);

    // 2. Set trial_ends_at for existing businesses that don't have it
    // Trial period = 14 days from business creation
    await client.query(`
      UPDATE businesses 
      SET trial_ends_at = created_at + INTERVAL '14 days'
      WHERE trial_ends_at IS NULL;
    `);

    // 3. Mark businesses past their trial as 'expired'
    await client.query(`
      UPDATE businesses
      SET subscription_status = 'expired'
      WHERE trial_ends_at < now() 
        AND subscription_status = 'trial';
    `);

    // 4. Create subscriptions table for tracking payments
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
        plan TEXT DEFAULT 'monthly',
        amount NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'MWK',
        status TEXT DEFAULT 'pending',
        paychangu_tx_ref TEXT,
        paychangu_tx_id TEXT,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // 5. Add index on business_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
    `);

    // 6. Add notifications table for trial reminders
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);
    `);

    await client.end();

    return NextResponse.json({ success: true, message: "Trial & subscription migration complete" });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
