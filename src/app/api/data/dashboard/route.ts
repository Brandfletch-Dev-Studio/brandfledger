import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get("business_id");
    
    if (!businessId) {
      const { data: businesses, error: bizError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.userId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (bizError) throw bizError;
      if (!businesses || businesses.length === 0) {
        return NextResponse.json({ error: "No business found" }, { status: 404 });
      }
      businessId = businesses[0].id;
    }

    // Verify ownership
    const { data: ownership, error: ownerError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('owner_id', user.userId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownership) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Fetch dashboard data
    const [transactionsResult, businessResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('business_id', businessId),
      supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle()
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (businessResult.error) throw businessResult.error;

    const transactions = transactionsResult.data || [];
    const business = businessResult.data;

    // Aggregate summary
    let sales_count = 0;
    let revenue = 0;
    let cost_of_sales = 0;
    let gross_profit = 0;
    let expenses = 0;
    let margin_sum = 0;
    let margin_count = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount || 0);
      const cost_amount = parseFloat(tx.cost_amount || 0);
      const profit = parseFloat(tx.profit || 0);
      const margin = parseFloat(tx.margin || 0);

      if (tx.type === 'income') {
        sales_count++;
        revenue += amount;
        cost_of_sales += cost_amount;
        // Fall back to amount - cost_amount if profit field is null/0 (direct transactions may not set profit)
        gross_profit += profit || (amount - cost_amount);
        if (margin > 0) {
          margin_sum += margin;
          margin_count++;
        }
      } else if (tx.type === 'expense') {
        expenses += amount;
      }
    }

    const avg_margin = margin_count > 0 ? (margin_sum / margin_count) : 0;

    const summary = {
      sales_count: sales_count.toString(),
      revenue: revenue.toString(),
      cost_of_sales: cost_of_sales.toString(),
      gross_profit: gross_profit.toString(),
      expenses: expenses.toString(),
      avg_margin: avg_margin.toString(),
    };

    // Calculate net profit
    const netProfit = parseFloat(summary.gross_profit) - parseFloat(summary.expenses);

    // Get recent transactions (limit 10, order by date desc, created_at desc)
    const recentTransactions = [...transactions]
      .sort((a, b) => {
        const dateCompare = (b.date || "").localeCompare(a.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (b.created_at || "").localeCompare(a.created_at || "");
      })
      .slice(0, 10);

    // Group transactions by date for daily data (ordered by date asc)
    const dailyMap: { [date: string]: { date: string; income: number | null; expenses: number | null } } = {};
    for (const tx of transactions) {
      const date = tx.date;
      const amount = parseFloat(tx.amount || 0);
      if (!dailyMap[date]) {
        dailyMap[date] = { date, income: null, expenses: null };
      }
      if (tx.type === 'income') {
        dailyMap[date].income = (dailyMap[date].income || 0) + amount;
      } else if (tx.type === 'expense') {
        dailyMap[date].expenses = (dailyMap[date].expenses || 0) + amount;
      }
    }
    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      business,
      summary: {
        ...summary,
        net_profit: netProfit,
      },
      recentTransactions,
      dailyData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
