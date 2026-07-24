import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getBusinessId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const ownership = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2", [requestedId, userId]);
    if (ownership.length === 0) return null;
    return requestedId;
  }
  const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [userId]);
  return businesses[0]?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "12");
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const business = await query("SELECT * FROM businesses WHERE id = $1", [businessId]);

    // Get all transactions for the period
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months + 1);
    fromDate.setDate(1);
    const fromStr = fromDate.toISOString().split("T")[0];

    const transactions = await query(
      `SELECT * FROM transactions WHERE business_id = $1 AND date >= $2 ORDER BY date DESC`,
      [businessId, fromStr]
    );

    // Build monthly summary
    const monthMap: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthMap[key] = { month: label, revenue: 0, expenses: 0, profit: 0 };
    }

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalCost = 0;

    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    for (const tx of transactions) {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      if (monthMap[key]) {
        if (tx.type === "income") {
          monthMap[key].revenue += Number(tx.amount);
          monthMap[key].profit += Number(tx.profit || (Number(tx.amount) - Number(tx.cost_amount || 0)));
          totalRevenue += Number(tx.amount);
          totalCost += Number(tx.cost_amount || 0);
          const cat = tx.category_name || "Uncategorized";
          incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(tx.amount);
        } else if (tx.type === "expense") {
          monthMap[key].expenses += Number(tx.amount);
          monthMap[key].profit -= Number(tx.amount);
          totalExpenses += Number(tx.amount);
          const cat = tx.category_name || "Uncategorized";
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(tx.amount);
        }
      }
    }

    const monthlyData = Object.values(monthMap).reverse();
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;

    // Top customers by revenue
    const customerRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const tx of transactions) {
      if (tx.type === "income" && tx.client_name) {
        if (!customerRevenue[tx.client_name]) {
          customerRevenue[tx.client_name] = { name: tx.client_name, revenue: 0, count: 0 };
        }
        customerRevenue[tx.client_name].revenue += Number(tx.amount);
        customerRevenue[tx.client_name].count += 1;
      }
    }
    const topCustomers = Object.values(customerRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Top products by revenue
    const productRevenue: Record<string, { name: string; revenue: number; count: number; profit: number }> = {};
    for (const tx of transactions) {
      if (tx.type === "income" && tx.product_id) {
        // Need product name — fetch if not in map
      }
    }

    return NextResponse.json({
      business: business[0],
      monthlyData,
      summary: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        cost: totalCost,
        grossProfit,
        netProfit,
        transactionCount: transactions.length,
      },
      incomeByCategory: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })),
      expenseByCategory: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })),
      topCustomers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
