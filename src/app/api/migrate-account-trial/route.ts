import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data: accounts } = await supabase
      .from("profiles")
      .select("id, email, full_name, subscription_status, trial_ends_at");
    return NextResponse.json({
      success: true,
      accounts_count: (accounts || []).length,
      accounts: accounts || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
