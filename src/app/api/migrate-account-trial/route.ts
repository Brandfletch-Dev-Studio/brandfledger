import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Idempotent migration: create accounts table keyed by user_id
// Trial is per-account, not per-business
export async function GET() {
  try {
    // 1. Create accounts table
    await query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
        subscription_status TEXT NOT NULL DEFAULT 'trial',
        trial_ends_at TIMESTAMPTZ,
        subscription_ends_at TIMESTAMPTZ,
        plan TEXT,
        paychangu_tx_ref TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Migrate existing data: for each unique owner_id in businesses,
    //    create an account row using the earliest business trial data
    await query(`
      INSERT INTO accounts (user_id, subscription_status, trial_ends_at, subscription_ends_at, created_at)
      SELECT DISTINCT ON (b.owner_id)
        b.owner_id,
        COALESCE(b.subscription_status, 'trial'),
        b.trial_ends_at,
        b.subscription_ends_at,
        b.created_at
      FROM businesses b
      WHERE b.owner_id IS NOT NULL
      ORDER BY b.owner_id, b.created_at ASC
      ON CONFLICT (user_id) DO NOTHING
    `);

    // 3. Fix any accounts without trial_ends_at
    await query(`
      UPDATE accounts
      SET trial_ends_at = NOW() + INTERVAL '14 days'
      WHERE trial_ends_at IS NULL AND subscription_status = 'trial'
    `);

    // 4. Mark expired trials
    await query(`
      UPDATE accounts
      SET subscription_status = 'expired'
      WHERE subscription_status = 'trial'
        AND trial_ends_at < NOW()
    `);

    const accounts = await query("SELECT user_id, subscription_status, trial_ends_at FROM accounts");
    return NextResponse.json({ success: true, accounts_created: accounts.length, accounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
