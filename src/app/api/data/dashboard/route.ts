import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get("business_id");
    
    if (!businessId) {
      const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
      if (businesses.length === 0) return NextResponse.json({ error: "No business found" }, { status: 404 });
      businessId = businesses[0].id;
    }

    // Verify ownership
    const ownership = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2", [businessId, user.userId]);
    if (ownership.length === 0) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Fetch dashboard data
    const [summary, recentTransactions, dailyData, business] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) FILTER (WHERE type = 'income') as sales_count,
          COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) as revenue,
          COALESCE(SUM(cost_amount) FILTER (WHERE type = 'income'), 0) as cost_of_sales,
          COALESCE(SUM(profit) FILTER (WHERE type = 'income'), 0) as gross_profit,
          COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as expenses,
          COALESCE(AVG(margin) FILTER (WHERE type = 'income' AND margin > 0), 0) as avg_margin
        FROM transactions WHERE business_id = $1
      `, [businessId]),
      query("SELECT * FROM transactions WHERE business_id = $1 ORDER BY date DESC, created_at DESC LIMIT 10", [businessId]),
      query(`
        SELECT date,
          SUM(amount) FILTER (WHERE type = 'income') as income,
          SUM(amount) FILTER (WHERE type = 'expense') as expenses
        FROM transactions WHERE business_id = $1
        GROUP BY date ORDER BY date ASC
      `, [businessId]),
      query("SELECT * FROM businesses WHERE id = $1", [businessId]),
    ]);

    // Calculate net profit
    const netProfit = parseFloat(summary[0].gross_profit) - parseFloat(summary[0].expenses);

    return NextResponse.json({
      business: business[0],
      summary: {
        ...summary[0],
        net_profit: netProfit,
      },
      recentTransactions,
      dailyData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
