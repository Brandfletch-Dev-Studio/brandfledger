import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Extends the trial period for all businesses by 14 days from now
// Useful for testing or when migrations set a past trial date

export async function POST() {
  try {
    await query(`
      UPDATE businesses 
      SET subscription_status = 'trial',
          trial_ends_at = now() + INTERVAL '14 days'
      WHERE subscription_status IN ('trial', 'expired')
    `);

    const result = await query("SELECT id, name, subscription_status, trial_ends_at FROM businesses");
    
    return NextResponse.json({ 
      success: true, 
      message: "Trial extended by 14 days for all businesses",
      businesses: result 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
