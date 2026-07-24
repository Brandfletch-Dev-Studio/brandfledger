import { createClient } from "@/lib/supabase/server";
import { getDefaultBusiness } from "@/lib/default-business";
import DashboardClient from "./dashboard-client";

export const metadata = { title: "Dashboard" };

function getPeriodRange(period: string) {
  const now = new Date();
  let start: Date;
  const end: Date = now;
  switch (period) {
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case "this_quarter":
      start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "all_time":
      start = new Date(2000, 0, 1);
      break;
    case "this_month":
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }
  // last_month should stop at the end of that month, not run into today
  const rangeEnd = period === "last_month" ? new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) : end;
  return { start, end: rangeEnd };
}

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string } }) {
  const supabase = await createClient();
  const period = searchParams?.period ?? "this_month";

  const { data: business } = await getDefaultBusiness(supabase);

  if (!business) {
    return <DashboardClient business={null} stats={null} setupStatus={{ hasBusiness: false, hasCustomer: false, hasProduct: false, hasInvoice: false }} period={period} />;
  }

  const [
    { data: invoices },
    { data: transactions },
    { data: customers },
  ] = await Promise.all([
    supabase.from("invoices").select("total, status, issue_date, created_at, id, invoice_number, customer_id, customers(name)").eq("business_id", business.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("transactions").select("*").eq("business_id", business.id).order("date", { ascending: false }),
    supabase.from("customers").select("id").eq("business_id", business.id),
  ]);

  const allInvoices = invoices ?? [];
  const allTransactions = transactions ?? [];

  // Period-scoped slices for the top summary cards
  const { start, end } = getPeriodRange(period);
  const inRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

  const periodTransactions = allTransactions.filter(t => inRange(t.date));
  const incomeTransactions = periodTransactions.filter(t => t.type === "income");
  const expenseTransactions = periodTransactions.filter(t => t.type === "expense");

  const totalRevenue = incomeTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalAdCost = incomeTransactions.reduce((sum, t) => sum + Number(t.ad_cost || 0), 0);
  const grossProfit = totalRevenue - totalAdCost;
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netProfit = grossProfit - totalExpenses;

  // Outstanding is a "right now" metric — not scoped to the selected period
  const outstandingInvoices = allInvoices.filter(i => i.status === "sent" || i.status === "overdue");
  const outstandingAmount = outstandingInvoices.reduce((s, i) => s + i.total, 0);

  const { data: hasCustomer } = await supabase.from("customers").select("id").eq("business_id", business.id).limit(1);
  const { data: hasProduct } = await supabase.from("products").select("id").eq("business_id", business.id).limit(1);
  const { data: hasInvoice } = await supabase.from("invoices").select("id").eq("business_id", business.id).limit(1);

  // Last 6 months of revenue, expenses & profit for the trend chart
  const monthMap: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { month: d.toLocaleDateString("en-US", { month: "short" }), revenue: 0, expenses: 0, profit: 0 };
  }

  allTransactions.forEach(tx => {
    if (!tx.date) return;
    const key = tx.date.slice(0, 7);
    if (monthMap[key]) {
      if (tx.type === "income") {
        monthMap[key].revenue += Number(tx.amount || 0);
        monthMap[key].expenses += Number(tx.ad_cost || 0);
      } else if (tx.type === "expense") {
        monthMap[key].expenses += Number(tx.amount || 0);
      }
    }
  });

  // Calculate profit per month
  Object.keys(monthMap).forEach(key => {
    monthMap[key].profit = monthMap[key].revenue - monthMap[key].expenses;
  });

  const monthlyTrend = Object.values(monthMap);

  // Top customers by total billed (all-time, all non-draft invoices)
  const customerTotals: Record<string, { name: string; total: number; invoiceCount: number }> = {};
  allInvoices.filter(i => i.status !== "draft").forEach(inv => {
    const name = (inv as any).customers?.name ?? "Unknown customer";
    const key = inv.customer_id ?? name;
    if (!customerTotals[key]) customerTotals[key] = { name, total: 0, invoiceCount: 0 };
    customerTotals[key].total += inv.total;
    customerTotals[key].invoiceCount += 1;
  });
  const topCustomers = Object.values(customerTotals).sort((a, b) => b.total - a.total).slice(0, 5);

  // Recent income transactions for "Profit per Sale" tracking
  const recentIncome = allTransactions.filter(t => t.type === "income").slice(0, 5);

  return (
    <DashboardClient
      business={business}
      period={period}
      stats={{
        totalRevenue,
        totalAdCost,
        grossProfit,
        netProfit,
        outstandingAmount,
        outstandingCount: outstandingInvoices.length,
        customerCount: (customers ?? []).length,
      }}
      setupStatus={{
        hasBusiness: true,
        hasCustomer: (hasCustomer ?? []).length > 0,
        hasProduct: (hasProduct ?? []).length > 0,
        hasInvoice: (hasInvoice ?? []).length > 0,
      }}
      recentInvoices={allInvoices.slice(0, 5)}
      recentIncome={recentIncome}
      monthlyTrend={monthlyTrend}
      topCustomers={topCustomers}
    />
  );
}
