import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUSINESS_ID = "7ef9b060-7679-46ce-a17e-9c6aefa84320";
const COST_RATE = 4300;

export async function POST() {
  try {
    await supabase
      .from("businesses")
      .update({ cost_rate: COST_RATE })
      .eq("id", BUSINESS_ID);

    const { data: txns } = await supabase
      .from("transactions")
      .select("id, amount, cost_qty")
      .eq("business_id", BUSINESS_ID)
      .eq("type", "income")
      .gt("cost_qty", 0);

    for (const t of txns || []) {
      const cost = (Number(t.cost_qty) || 0) * COST_RATE;
      const profit = Number(t.amount) - cost;
      const margin = Number(t.amount) > 0
        ? Math.round((profit / Number(t.amount)) * 10000) / 100
        : 0;
      await supabase
        .from("transactions")
        .update({ cost_amount: cost, profit, margin })
        .eq("id", t.id);
    }

    return NextResponse.json({
      success: true,
      message: `Cost rate set to ${COST_RATE} MK/$ and ${(txns || []).length} transactions recalculated`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
