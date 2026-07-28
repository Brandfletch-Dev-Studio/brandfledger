import { getDbUser, supabase } from "@/lib/db";
import { cookies } from "next/headers";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function getPeriodRange(period: string) {
  const now = new Date();
  let start: Date;
  const end: Date = now;
  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
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
  const rangeEnd = period === "last_month" ? new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) : end;
  return { start, end: rangeEnd };
}

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string } }) {
  const period = searchParams?.period ?? "this_month";
  let user: { userId: string; email: string } | null = null;

  try {
    user = getDbUser();
  } catch (e) {
    console.error("getDbUser error:", e);
  }

  if (!user) {
    return <DashboardClient business={null} stats={null} setupStatus={{ hasBusiness: false, hasCustomer: false, hasProduct: false, hasInvoice: false }} period={period} />;
  }

  try {
    // Get user's businesses
    const { data: businesses } = await supabase.from("businesses").select("id, name, currency, invoice_prefix, address, phone, email, logo_url").eq("owner_id", user.userId).order("created_at");
    
    // Respect the active business selection (stored in cookie by the business switcher)
    const cookieStore = cookies();
    const activeBusinessId = cookieStore.get("activeBusinessId")?.value;
    const bizList = businesses || []; const business = (activeBusinessId && bizList.find((b: any) => b.id === activeBusinessId)) || bizList[0] || null;

    if (!business) {
      return <DashboardClient business={null} stats={null} setupStatus={{ hasBusiness: false, hasCustomer: false, hasProduct: false, hasInvoice: false }} period={period} />;
    }

    // Fetch all data in parallel
    const [invRes, txRes, custRes, hasCustomerRes, hasProductRes, hasInvoiceRes] = await Promise.all([
      supabase.from("invoices").select("total, status, issue_date, created_at, id, invoice_number, customer_id").eq("business_id", business.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("transactions").select("*").eq("business_id", business.id).order("date", { ascending: false }),
      supabase.from("customers").select("id").eq("business_id", business.id),
      supabase.from("customers").select("id").eq("business_id", business.id).limit(1),
      supabase.from("products").select("id").eq("business_id", business.id).limit(1),
      supabase.from("invoices").select("id").eq("business_id", business.id).limit(1),
    ]);
    const invoices = invRes.data || [];
    const transactions = txRes.data || [];
    const customers = custRes.data || [];
    const hasCustomer = hasCustomerRes.data || [];
    const hasProduct = hasProductRes.data || [];
    const hasInvoice = hasInvoiceRes.data || [];

    // Get customer names for invoices
    const customerIds = Array.from(new Set(invoices.map((i: any) => i.customer_id).filter(Boolean))) as string[];
    let customerMap: Record<string, string> = {};
    if (customerIds.length > 0) {
      const { data: customersData } = await supabase.from("customers").select("id, name").in("id", customerIds);
      customerMap = Object.fromEntries((customersData || []).map((c: any) => [c.id, c.name]));
    }

    const allInvoices = invoices.map((i: any) => ({ ...i, customers: { name: customerMap[i.customer_id] ?? "Unknown" } }));
    const allTransactions = transactions;

    // Period-scoped slices
    const { start, end } = getPeriodRange(period);
    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return false;
      const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
      return d >= start && d <= end;
    };

    const periodTransactions = allTransactions.filter((t: any) => inRange(t.date));
    const incomeTransactions = periodTransactions.filter((t: any) => t.type === "income");
    const expenseTransactions = periodTransactions.filter((t: any) => t.type === "expense");

    const totalRevenue = incomeTransactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const totalCost = incomeTransactions.reduce((sum: number, t: any) => sum + Number(t.cost_amount || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const totalExpenses = expenseTransactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const netProfit = grossProfit - totalExpenses;

    const outstandingInvoices = allInvoices.filter((i: any) => i.status === "sent" || i.status === "overdue");
    const outstandingAmount = outstandingInvoices.reduce((s: number, i: any) => s + i.total, 0);

    // Monthly trend
    const monthMap: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { month: d.toLocaleDateString("en-US", { month: "short" }), revenue: 0, expenses: 0, profit: 0 };
    }

    allTransactions.forEach((tx: any) => {
      if (!tx.date) return; const txDate = typeof tx.date === "string" ? tx.date : new Date(tx.date).toISOString();
      const key = txDate.slice(0, 7);
      if (monthMap[key]) {
        if (tx.type === "income") {
          monthMap[key].revenue += Number(tx.amount || 0);
          monthMap[key].expenses += Number(tx.cost_amount || 0);
        } else if (tx.type === "expense") {
          monthMap[key].expenses += Number(tx.amount || 0);
        }
      }
    });

    Object.keys(monthMap).forEach(key => {
      monthMap[key].profit = monthMap[key].revenue - monthMap[key].expenses;
    });

    const monthlyTrend = Object.values(monthMap);

    // Top customers
    const customerTotals: Record<string, { name: string; total: number; invoiceCount: number }> = {};
    allInvoices.filter((i: any) => i.status !== "draft").forEach((inv: any) => {
      const name = inv.customers?.name ?? "Unknown customer";
      const key = inv.customer_id ?? name;
      if (!customerTotals[key]) customerTotals[key] = { name, total: 0, invoiceCount: 0 };
      customerTotals[key].total += inv.total;
      customerTotals[key].invoiceCount += 1;
    });
    const topCustomers = Object.values(customerTotals).sort((a, b) => b.total - a.total).slice(0, 5);

    const recentIncome = allTransactions.filter((t: any) => t.type === "income").slice(0, 10);

    return (
      <DashboardClient
        business={business}
        period={period}
        stats={{
          totalRevenue,
          totalCost,
          grossProfit,
          netProfit,
          outstandingAmount,
          outstandingCount: outstandingInvoices.length,
          customerCount: customers.length,
        }}
        setupStatus={{
          hasBusiness: true,
          hasCustomer: hasCustomer.length > 0,
          hasProduct: hasProduct.length > 0,
          hasInvoice: hasInvoice.length > 0,
        }}
        recentInvoices={allInvoices.slice(0, 5)}
        recentIncome={recentIncome}
        monthlyTrend={monthlyTrend}
        topCustomers={topCustomers}
      />
    );
  } catch (err: any) {
    console.error("Dashboard page error:", err?.message || err);
    // Return a minimal dashboard with the error shown
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold mb-2">Dashboard loading error</h2>
        <p className="text-sm text-muted-foreground mb-4">
          There was a problem loading your data. This is usually a temporary database connectivity issue.
        </p>
        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">{err?.message || String(err)}</pre>
      </div>
    );
  }
}
