import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called by a Vercel cron job or Upstash scheduler
// Also exposed as POST so the verify endpoint can call it inline
export async function GET(req: NextRequest) {
  return handler();
}

export async function POST(req: NextRequest) {
  return handler();
}

async function handler() {
  try {
    // Cancel pending subscriptions older than 15 minutes
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: stale, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, business_id, paychangu_tx_ref, created_at")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    if (fetchErr) throw fetchErr;

    if (!stale || stale.length === 0) {
      return NextResponse.json({ cancelled: 0, message: "No stale pending subscriptions" });
    }

    const ids = stale.map((s: any) => s.id);

    const { error: cancelErr } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (cancelErr) throw cancelErr;

    console.log(`[cancel-pending] Cancelled ${ids.length} stale subscriptions:`, ids);

    return NextResponse.json({
      cancelled: ids.length,
      ids,
      message: `Cancelled ${ids.length} stale pending subscription(s) older than 15 minutes`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
