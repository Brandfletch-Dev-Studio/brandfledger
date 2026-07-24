import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUSINESS_ID = "7ef9b060-7679-46ce-a17e-9c6aefa84320";

export async function POST() {
  try {
    // 1. Set cost_rate to 4300 (MK per USD)
    await query(
      `UPDATE businesses SET cost_rate = 4300, cost_rate_label = 'USD to MK rate', cost_rate_unit = 'MK/$' WHERE id = $1`,
      [BUSINESS_ID]
    );

    // 2. Recalculate all income transactions with cost_qty > 0
    // The trigger will recalculate cost_amount and profit on update
    await query(
      `UPDATE transactions 
       SET cost_amount = cost_qty * 4300,
           profit = amount - (cost_qty * 4300),
           margin = CASE WHEN amount > 0 THEN ROUND((amount - cost_qty * 4300) / amount * 100, 2) ELSE 0 END
       WHERE business_id = $1 AND type = 'income' AND cost_qty > 0`,
      [BUSINESS_ID]
    );

    // 3. Get updated summary
    const summary = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE type = 'income') as income_count,
        COUNT(*) FILTER (WHERE type = 'expense') as expense_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) as total_income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as total_expenses,
        COALESCE(SUM(cost_amount) FILTER (WHERE type = 'income'), 0) as total_ad_cost,
        COALESCE(SUM(profit) FILTER (WHERE type = 'income'), 0) as gross_profit,
        COALESCE(SUM(cost_qty) FILTER (WHERE type = 'income'), 0) as total_usd_ads
      FROM transactions WHERE business_id = $1
    `, [BUSINESS_ID]);

    return NextResponse.json({
      success: true,
      message: "Cost rate set to 4300 MK/$ and all transactions recalculated",
      summary: summary[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
