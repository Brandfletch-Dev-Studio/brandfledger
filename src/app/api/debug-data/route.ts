import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const [txRes, invRes] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }).limit(50),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    return NextResponse.json({
      transactions: txRes.data || [],
      invoices: invRes.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
