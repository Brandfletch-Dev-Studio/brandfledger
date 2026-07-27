import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString();
    await supabase
      .from("businesses")
      .update({ subscription_status: "trial", trial_ends_at: trialEnd })
      .in("subscription_status", ["trial", "expired"]);
    const { data } = await supabase
      .from("businesses")
      .select("id, name, subscription_status, trial_ends_at");
    return NextResponse.json({
      success: true,
      message: "Trial extended by 14 days",
      businesses: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
