// Brandfledger WhatsApp Finance Manager — Function Implementations
// All database operations use the Supabase client from @/lib/db (service role, bypasses RLS)

import { supabase } from "@/lib/db";

export interface FunctionContext {
  business_id: string;
  business_name: string;
  currency: string;
}

// ============================================================
// HELPERS
// ============================================================

function dateRange(period?: string): { start: string; end: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  let start = new Date();
  let end = today;

  switch (period) {
    case "today":
      start = new Date();
      end = today;
      break;
    case "yesterday": {
      const y = new Date(now.getTime() - 86400000);
      const yStr = y.toISOString().split("T")[0];
      start = y;
      end = yStr;  // FIX: end should be yesterday, not today
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = today;  // up to today — correct
      break;
    case "last_month": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      // Last day of last month = day before first day of this month
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];  // FIX
      break;
    }
    case "this_week": {
      const d = now.getDay() || 7;
      start = new Date(now.getTime() - (d - 1) * 86400000);
      end = today;  // up to today — correct
      break;
    }
    case "last_week": {
      const d = now.getDay() || 7;
      start = new Date(now.getTime() - (d + 6) * 86400000);  // Monday of last week
      end = new Date(now.getTime() - d * 86400000).toISOString().split("T")[0];  // FIX: Sunday of last week
      break;
    }
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      end = today;  // up to today — correct
      break;
    default:
      start = new Date(now.getTime() - 30 * 86400000);
      end = today;  // last 30 days up to today — correct
  }
  return { start: start.toISOString().split("T")[0], end };
}

function sum(data: any[] | null | undefined, field: string): number {
  if (!data) return 0;
  return data.reduce((s, item) => s + Number(item[field] || 0), 0);
}

// ============================================================
// READ FUNCTIONS
// ============================================================

async function resolveCustomer(ctx: FunctionContext, name: string) {
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, email, total_invoiced")
    .eq("business_id", ctx.business_id);
  if (!data) return { matched: false, new: true };

  const normalized = name.toLowerCase().trim();
  const exact = data.find((c) => c.name?.toLowerCase().trim() === normalized);
  if (exact) return { customer: exact, matched: true };

  const partial = data.filter(
    (c) => c.name?.toLowerCase().includes(normalized) || normalized.includes(c.name?.toLowerCase())
  );
  if (partial.length === 1) return { customer: partial[0], matched: true };
  if (partial.length > 1) return { customers: partial, matched: false, ambiguous: true };
  return { matched: false, new: true };
}


async function resolveProduct(ctx: FunctionContext, name: string) {
  const { data } = await supabase
    .from("products")
    .select("id, name, price, cost, category, unit, is_active")
    .eq("business_id", ctx.business_id);
  if (!data) return { matched: false, new: true };

  const normalized = name.toLowerCase().trim();
  const exact = data.find((p) => p.name?.toLowerCase().trim() === normalized);
  if (exact) return { product: exact, matched: true };

  const partial = data.filter(
    (p) => p.name?.toLowerCase().includes(normalized) || normalized.includes(p.name?.toLowerCase())
  );
  if (partial.length === 1) return { product: partial[0], matched: true };
  if (partial.length > 1) return { products: partial, matched: false, ambiguous: true };
  return { matched: false, new: true };
}

async function queryRevenue(ctx: FunctionContext, period?: string) {
  let query = supabase
    .from("transactions")
    .select("amount, cost_amount, profit, client_name, description, type")
    .eq("business_id", ctx.business_id)
    .eq("type", "income");
  if (period) {
    const { start, end } = dateRange(period);
    query = query.gte("date", start).lte("date", end);
  }
  const { data } = await query;
  return { revenue: sum(data, "amount"), cost: sum(data, "cost_amount"), profit: sum(data, "profit"), count: data?.length || 0 };
}

async function queryExpenses(ctx: FunctionContext, period?: string) {
  let query = supabase
    .from("transactions")
    .select("amount, client_name, description, type")
    .eq("business_id", ctx.business_id)
    .eq("type", "expense");
  if (period) {
    const { start, end } = dateRange(period);
    query = query.gte("date", start).lte("date", end);
  }
  const { data } = await query;
  const total = sum(data, "amount");
  const byCategory: Record<string, number> = {};
  data?.forEach((t) => {
    const cat = t.description || t.client_name || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount || 0);
  });
  const sorted = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { total_expenses: total, by_category: sorted, count: data?.length || 0 };
}

async function queryReceivables(ctx: FunctionContext) {
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, balance_due, status, due_date, customers(name)")
    .eq("business_id", ctx.business_id)
    .in("status", ["draft", "sent", "overdue"]);
  if (!data) return { total_receivables: 0, customers: [] };

  const byCustomer: Record<string, any> = {};
  let grandTotal = 0;
  data.forEach((inv: any) => {
    const name = inv.customers?.name || "Unknown";
    const due = Number(inv.balance_due || (inv.total - (inv.amount_paid || 0)));
    if (due <= 0) return;
    grandTotal += due;
    if (!byCustomer[name]) byCustomer[name] = { customer: name, total_due: 0, invoice_count: 0 };
    byCustomer[name].total_due += due;
    byCustomer[name].invoice_count += 1;
  });
  return {
    total_receivables: grandTotal,
    customers: Object.values(byCustomer).sort((a: any, b: any) => b.total_due - a.total_due),
  };
}

async function getCustomerBalance(ctx: FunctionContext, customerName: string) {
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", ctx.business_id)
    .ilike("name", `%${customerName}%`);
  if (!customers || customers.length === 0) return { error: "Customer not found" };
  const customerId = customers[0].id;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, balance_due, status, due_date")
    .eq("business_id", ctx.business_id)
    .eq("customer_id", customerId)
    .in("status", ["draft", "sent", "overdue"]);
  return { customer: customers[0].name, total_outstanding: sum(invoices, "balance_due"), invoices: invoices || [] };
}

async function getDailySummary(ctx: FunctionContext, period?: string) {
  const { start, end } = dateRange(period || "yesterday");
  const { data } = await supabase
    .from("transactions")
    .select("amount, type, profit, description, client_name")
    .eq("business_id", ctx.business_id)
    .gte("date", start)
    .lte("date", end);
  const income = sum(data?.filter((t) => t.type === "income"), "amount");
  const expenses = sum(data?.filter((t) => t.type === "expense"), "amount");
  return { date: start, income, expenses, net_cash: income - expenses, count: data?.length || 0 };
}

async function getWeeklySummary(ctx: FunctionContext) {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  const { data: thisWeek } = await supabase
    .from("transactions")
    .select("amount, type, description")
    .eq("business_id", ctx.business_id)
    .gte("date", weekStart)
    .lte("date", todayStr);
  const { data: prevWeek } = await supabase
    .from("transactions")
    .select("amount, type, description")
    .eq("business_id", ctx.business_id)
    .gte("date", prevWeekStart)
    .lt("date", weekStart);

  const thisIncome = sum(thisWeek?.filter((t) => t.type === "income"), "amount");
  const thisExpenses = sum(thisWeek?.filter((t) => t.type === "expense"), "amount");
  const prevIncome = sum(prevWeek?.filter((t) => t.type === "income"), "amount");
  const prevExpenses = sum(prevWeek?.filter((t) => t.type === "expense"), "amount");

  const byCategory: Record<string, number> = {};
  thisWeek?.filter((t) => t.type === "expense").forEach((t) => {
    const cat = t.description || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount || 0);
  });
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return {
    this_week: { income: thisIncome, expenses: thisExpenses, net: thisIncome - thisExpenses },
    previous_week: { income: prevIncome, expenses: prevExpenses, net: prevIncome - prevExpenses },
    income_change_pct: prevIncome > 0 ? Math.round((thisIncome - prevIncome) / prevIncome * 100) : 0,
    expense_change_pct: prevExpenses > 0 ? Math.round((thisExpenses - prevExpenses) / prevExpenses * 100) : 0,
    biggest_expense_category: sortedCats[0]?.[0] || null,
    biggest_expense_amount: sortedCats[0]?.[1] || 0,
  };
}

async function checkOverdueInvoices(ctx: FunctionContext) {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, balance_due, due_date, customers(name)")
    .eq("business_id", ctx.business_id)
    .lt("due_date", today)
    .in("status", ["sent", "draft"]);
  const overdue = data?.filter((inv: any) => Number(inv.balance_due || 0) > 0) || [];
  return {
    overdue_count: overdue.length,
    total_overdue: sum(overdue as any[], "balance_due"),
    invoices: overdue.map((inv: any) => ({
      invoice_number: inv.invoice_number,
      customer: inv.customers?.name || "Unknown",
      amount: Number(inv.balance_due || 0),
      due_date: inv.due_date,
    })),
  };
}

async function analyzeCashFlow(ctx: FunctionContext) {
  const { data: allTx } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("business_id", ctx.business_id);
  const totalIncome = sum(allTx?.filter((t) => t.type === "income"), "amount");
  const totalExpenses = sum(allTx?.filter((t) => t.type === "expense"), "amount");
  const currentCash = totalIncome - totalExpenses;

  const { data: receivables } = await supabase
    .from("invoices")
    .select("balance_due")
    .eq("business_id", ctx.business_id)
    .in("status", ["draft", "sent", "overdue"]);

  const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
  const { data: recentExp } = await supabase
    .from("transactions")
    .select("amount")
    .eq("business_id", ctx.business_id)
    .eq("type", "expense")
    .gte("date", threeMonthsAgo);

  const today = new Date().toISOString().split("T")[0];
  const { data: overdueInv } = await supabase
    .from("invoices")
    .select("balance_due")
    .eq("business_id", ctx.business_id)
    .lt("due_date", today)
    .in("status", ["sent", "draft"]);

  const totalReceivables = sum(receivables, "balance_due");
  const monthlyAvgExpenses = recentExp ? sum(recentExp, "amount") / 3 : 0;
  const totalOverdue = sum(overdueInv?.filter((inv: any) => Number(inv.balance_due || 0) > 0), "balance_due");

  return {
    current_cash: currentCash,
    expected_receivables: totalReceivables,
    overdue_amount: totalOverdue,
    monthly_expense_average: Math.round(monthlyAvgExpenses),
    projected_cash: currentCash + totalReceivables,
  };
}

async function comparePeriods(ctx: FunctionContext, period1?: string, period2?: string) {
  const p1 = dateRange(period1 || "this_month");
  const p2 = dateRange(period2 || "last_month");

  const [d1, d2] = await Promise.all([
    supabase.from("transactions").select("amount, type").eq("business_id", ctx.business_id).gte("date", p1.start).lte("date", p1.end),
    supabase.from("transactions").select("amount, type").eq("business_id", ctx.business_id).gte("date", p2.start).lte("date", p2.end),
  ]);

  const rev1 = sum(d1.data?.filter((t) => t.type === "income"), "amount");
  const rev2 = sum(d2.data?.filter((t) => t.type === "income"), "amount");
  const exp1 = sum(d1.data?.filter((t) => t.type === "expense"), "amount");
  const exp2 = sum(d2.data?.filter((t) => t.type === "expense"), "amount");

  return {
    period_1: { label: period1, revenue: rev1, expenses: exp1, net: rev1 - exp1 },
    period_2: { label: period2, revenue: rev2, expenses: exp2, net: rev2 - exp2 },
    revenue_change: rev1 - rev2,
    expense_change: exp1 - exp2,
    revenue_change_pct: rev2 > 0 ? Math.round((rev1 - rev2) / rev2 * 100) : 0,
  };
}

async function topCustomers(ctx: FunctionContext, period?: string) {
  const { start, end } = dateRange(period || "this_year");
  const { data } = await supabase
    .from("transactions")
    .select("amount, client_name")
    .eq("business_id", ctx.business_id)
    .eq("type", "income")
    .gte("date", start)
    .lte("date", end);
  const byCustomer: Record<string, any> = {};
  data?.forEach((t) => {
    const name = t.client_name || "Unknown";
    if (!byCustomer[name]) byCustomer[name] = { customer: name, total: 0, count: 0 };
    byCustomer[name].total += Number(t.amount || 0);
    byCustomer[name].count += 1;
  });
  return { customers: Object.values(byCustomer).sort((a, b) => b.total - a.total).slice(0, 10) };
}


// ============================================================
// ADVANCED READ FUNCTIONS — State of the Art
// ============================================================

async function listCustomers(ctx: FunctionContext, args: { limit?: number }) {
  const limit = Math.min(args.limit || 15, 50);
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, email, total_invoiced, created_at")
    .eq("business_id", ctx.business_id)
    .order("total_invoiced", { ascending: false })
    .limit(limit);
  return { customers: data || [], count: data?.length || 0 };
}

async function getCustomerDetail(ctx: FunctionContext, args: { customer_name?: string; customer_id?: string }) {
  // Find the customer
  let query = supabase
    .from("customers")
    .select("id, name, phone, email, address, notes, total_invoiced, created_at")
    .eq("business_id", ctx.business_id);

  if (args.customer_id) {
    query = query.eq("id", args.customer_id);
  } else if (args.customer_name) {
    // Try exact match first, then partial
    const { data: all } = await supabase
      .from("customers")
      .select("id, name, phone, email, address, notes, total_invoiced, created_at")
      .eq("business_id", ctx.business_id);
    if (!all) return { error: "No customers found" };
    const norm = args.customer_name.toLowerCase().trim();
    const exact = all.find(c => c.name?.toLowerCase().trim() === norm);
    const customer = exact || all.find(c => c.name?.toLowerCase().includes(norm) || norm.includes(c.name?.toLowerCase()));
    if (!customer) return { error: `No customer found matching "${args.customer_name}"` };
    return getCustomerFullProfile(ctx, customer);
  } else {
    return { error: "Provide customer_name or customer_id" };
  }

  const { data: customer } = await query.maybeSingle();
  if (!customer) return { error: "Customer not found" };
  return getCustomerFullProfile(ctx, customer);
}

async function getCustomerFullProfile(ctx: FunctionContext, customer: any) {
  const [txRes, invRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount, description, date, profit, margin")
      .eq("business_id", ctx.business_id)
      .eq("client_name", customer.name)
      .order("date", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total, amount_paid, balance_due")
      .eq("business_id", ctx.business_id)
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(10),
  ]);

  const txs = txRes.data || [];
  const totalRevenue = sum(txs.filter(t => t.type === "income"), "amount");
  const outstandingInvoices = (invRes.data || []).filter(i => ["sent", "partial", "overdue"].includes(i.status));
  const totalOutstanding = sum(outstandingInvoices, "balance_due");

  return {
    customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, notes: customer.notes },
    total_invoiced: customer.total_invoiced,
    total_outstanding: totalOutstanding,
    transaction_count: txs.length,
    recent_transactions: txs.slice(0, 5).map(t => ({ type: t.type, amount: t.amount, description: t.description, date: t.date, profit: t.profit, margin: t.margin })),
    recent_invoices: (invRes.data || []).slice(0, 5).map(i => ({ number: i.invoice_number, status: i.status, total: i.total, balance: i.balance_due, due: i.due_date })),
  };
}

async function searchTransactions(ctx: FunctionContext, args: { query?: string; min_amount?: number; max_amount?: number; type?: string; start_date?: string; end_date?: string; limit?: number }) {
  const limit = Math.min(args.limit || 15, 30);
  let query = supabase
    .from("transactions")
    .select("id, type, amount, description, client_name, vendor_name, category_name, date, payment_method, profit, margin")
    .eq("business_id", ctx.business_id)
    .order("date", { ascending: false })
    .limit(limit);

  if (args.type) query = query.eq("type", args.type);
  if (args.min_amount) query = query.gte("amount", args.min_amount);
  if (args.max_amount) query = query.lte("amount", args.max_amount);
  if (args.start_date) query = query.gte("date", args.start_date);
  if (args.end_date) query = query.lte("date", args.end_date);
  if (args.query) {
    // Sanitize search query: strip PostgREST-special characters to prevent filter injection
    const sanitized = args.query.replace(/[,.()\\]/g, " ").trim();
    if (sanitized) {
      query = query.or(`description.ilike.%${sanitized}%,client_name.ilike.%${sanitized}%,vendor_name.ilike.%${sanitized}%,category_name.ilike.%${sanitized}%`);
    }
  }

  const { data } = await query;
  return { transactions: data || [], count: data?.length || 0 };
}

async function getReceivablesAging(ctx: FunctionContext) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total, balance_due, due_date, status, issue_date")
    .eq("business_id", ctx.business_id)
    .in("status", ["sent", "partial", "overdue"]);

  if (!invoices || invoices.length === 0) return { aging: { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 }, total: 0, count: 0 };

  const now = new Date();
  const buckets: Record<string, number> = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
  const bucketDetails: Record<string, any[]> = { current: [], days_1_30: [], days_31_60: [], days_61_90: [], days_90_plus: [] };

  // Get customer names
  const customerIds = Array.from(new Set(invoices.map(i => i.customer_id).filter(Boolean)));
  let customerMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase.from("customers").select("id, name").in("id", customerIds);
    customers?.forEach(c => { customerMap[c.id] = c.name; });
  }

  for (const inv of invoices) {
    const balance = Number(inv.balance_due ?? inv.total);
    if (balance <= 0) continue;
    const dueDate = new Date(inv.due_date);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);

    let bucket: string;
    if (daysOverdue <= 0) bucket = "current";
    else if (daysOverdue <= 30) bucket = "days_1_30";
    else if (daysOverdue <= 60) bucket = "days_31_60";
    else if (daysOverdue <= 90) bucket = "days_61_90";
    else bucket = "days_90_plus";

    buckets[bucket] += balance;
    bucketDetails[bucket].push({
      invoice: inv.invoice_number,
      customer: customerMap[inv.customer_id] || "Unknown",
      balance,
      due_date: inv.due_date,
      days_overdue: Math.max(0, daysOverdue),
    });
  }

  return {
    aging: buckets,
    total: Object.values(buckets).reduce((a, b) => a + b, 0),
    count: invoices.filter(i => Number(i.balance_due ?? i.total) > 0).length,
    details: bucketDetails,
  };
}

async function getExpenseBreakdown(ctx: FunctionContext, args: { period?: string }) {
  const { start, end } = dateRange(args.period);
  const { data } = await supabase
    .from("transactions")
    .select("amount, category_name, description, vendor_name, date")
    .eq("business_id", ctx.business_id)
    .eq("type", "expense")
    .gte("date", start)
    .lte("date", end);

  if (!data || data.length === 0) return { categories: [], total: 0, count: 0 };

  const byCategory: Record<string, { total: number; count: number; items: any[] }> = {};
  for (const tx of data) {
    const cat = tx.category_name || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0, items: [] };
    byCategory[cat].total += Number(tx.amount);
    byCategory[cat].count += 1;
    if (byCategory[cat].items.length < 3) {
      byCategory[cat].items.push({ description: tx.description, amount: tx.amount, date: tx.date, vendor: tx.vendor_name });
    }
  }

  const total = sum(data, "amount");
  const categories = Object.entries(byCategory)
    .map(([name, info]) => ({
      category: name,
      total: info.total,
      count: info.count,
      percentage: total > 0 ? Math.round(info.total / total * 100) : 0,
      top_items: info.items,
    }))
    .sort((a, b) => b.total - a.total);

  return { categories, total, count: data.length, period: args.period || "this_month" };
}

async function getProfitAnalysis(ctx: FunctionContext, args: { period?: string; by?: string }) {
  const { start, end } = dateRange(args.period);
  const { data } = await supabase
    .from("transactions")
    .select("amount, cost_amount, profit, margin, client_name, description, type, date")
    .eq("business_id", ctx.business_id)
    .eq("type", "income")
    .gte("date", start)
    .lte("date", end);

  if (!data || data.length === 0) return { total_revenue: 0, total_cost: 0, total_profit: 0, avg_margin: 0, count: 0 };

  const totalRevenue = sum(data, "amount");
  const totalCost = sum(data, "cost_amount");
  const totalProfit = sum(data, "profit");
  const avgMargin = totalRevenue > 0 ? Math.round(totalProfit / totalRevenue * 100) : 0;

  if (args.by === "customer") {
    const byCustomer: Record<string, any> = {};
    for (const tx of data) {
      const name = tx.client_name || "Unknown";
      if (!byCustomer[name]) byCustomer[name] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      byCustomer[name].revenue += Number(tx.amount);
      byCustomer[name].cost += Number(tx.cost_amount || 0);
      byCustomer[name].profit += Number(tx.profit || 0);
      byCustomer[name].count += 1;
    }
    const customers = Object.entries(byCustomer)
      .map(([name, v]) => ({ customer: name, ...v, margin: v.revenue > 0 ? Math.round(v.profit / v.revenue * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);
    return { total_revenue: totalRevenue, total_cost: totalCost, total_profit: totalProfit, avg_margin: avgMargin, count: data.length, by_customer: customers };
  }

  return {
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_profit: totalProfit,
    avg_margin: avgMargin,
    count: data.length,
    best_margin: data.reduce((best, tx) => (tx.margin > best.margin ? tx : best), data[0]),
    worst_margin: data.reduce((worst, tx) => (tx.margin < worst.margin ? tx : worst), data[0]),
  };
}

async function getFinancialHealth(ctx: FunctionContext) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];

  const [thisMonthRes, lastMonthRes, receivablesRes, overdueRes, allTxRes] = await Promise.all([
    supabase.from("transactions").select("type, amount").eq("business_id", ctx.business_id).gte("date", thisMonthStart).lte("date", today),
    supabase.from("transactions").select("type, amount").eq("business_id", ctx.business_id).gte("date", lastMonthStart).lte("date", lastMonthEnd),
    supabase.from("invoices").select("balance_due, status").eq("business_id", ctx.business_id).in("status", ["sent", "partial", "overdue"]),
    supabase.from("invoices").select("balance_due, due_date").eq("business_id", ctx.business_id).in("status", ["sent", "partial", "overdue"]).lt("due_date", today),
    supabase.from("transactions").select("type, amount, profit").eq("business_id", ctx.business_id).gte("date", threeMonthsAgo).lte("date", today),
  ]);

  const thisIncome = sum(thisMonthRes.data?.filter(t => t.type === "income"), "amount");
  const thisExpenses = sum(thisMonthRes.data?.filter(t => t.type === "expense"), "amount");
  const lastIncome = sum(lastMonthRes.data?.filter(t => t.type === "income"), "amount");
  const lastExpenses = sum(lastMonthRes.data?.filter(t => t.type === "expense"), "amount");

  const totalReceivables = sum(receivablesRes.data, "balance_due");
  const totalOverdue = sum(overdueRes.data, "balance_due");

  const threeMoIncome = sum(allTxRes.data?.filter(t => t.type === "income"), "amount");
  const threeMoProfit = sum(allTxRes.data?.filter(t => t.type === "income"), "profit");
  const threeMoExpenses = sum(allTxRes.data?.filter(t => t.type === "expense"), "amount");

  // Revenue trend: +1 growing, 0 stable, -1 declining
  const revenueTrend = thisIncome > lastIncome * 1.1 ? 1 : thisIncome < lastIncome * 0.9 ? -1 : 0;

  // Profit margin
  const profitMargin = thisIncome > 0 ? Math.round((thisIncome - thisExpenses) / thisIncome * 100) : 0;

  // Burn rate (monthly expenses average)
  const monthlyBurn = threeMoExpenses / 3;

  // Liquidity: receivables vs monthly burn
  const runwayMonths = monthlyBurn > 0 ? Math.round(totalReceivables / monthlyBurn * 10) / 10 : 0;

  // Score calculation (0-100)
  let score = 50;
  if (revenueTrend > 0) score += 15;
  if (revenueTrend < 0) score -= 15;
  if (profitMargin >= 30) score += 15;
  else if (profitMargin >= 15) score += 8;
  else if (profitMargin < 0) score -= 20;
  if (totalOverdue === 0) score += 10;
  else if (totalOverdue > totalReceivables * 0.5) score -= 15;
  if (thisIncome > thisExpenses) score += 10;
  else score -= 10;
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

  return {
    score,
    grade,
    revenue_trend: revenueTrend > 0 ? "growing" : revenueTrend < 0 ? "declining" : "stable",
    this_month: { income: thisIncome, expenses: thisExpenses, net: thisIncome - thisExpenses, margin: profitMargin },
    vs_last_month: { income_change: thisIncome - lastIncome, expense_change: thisExpenses - lastExpenses },
    receivables: { total: totalReceivables, overdue: totalOverdue, overdue_pct: totalReceivables > 0 ? Math.round(totalOverdue / totalReceivables * 100) : 0 },
    burn_rate: { monthly: Math.round(monthlyBurn), runway_months: runwayMonths },
    quarterly: { income: threeMoIncome, profit: threeMoProfit, avg_margin: threeMoIncome > 0 ? Math.round(threeMoProfit / threeMoIncome * 100) : 0 },
  };
}

async function getBurnRate(ctx: FunctionContext) {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, date")
    .eq("business_id", ctx.business_id)
    .gte("date", threeMonthsAgo)
    .lte("date", today);

  if (!data) return { monthly_burn: 0, monthly_income: 0, net_monthly: 0 };

  const income = sum(data.filter(t => t.type === "income"), "amount");
  const expenses = sum(data.filter(t => t.type === "expense"), "amount");
  const monthlyIncome = Math.round(income / 3);
  const monthlyBurn = Math.round(expenses / 3);
  const netMonthly = monthlyIncome - monthlyBurn;

  return {
    monthly_burn: monthlyBurn,
    monthly_income: monthlyIncome,
    net_monthly: netMonthly,
    trend: netMonthly >= 0 ? "profitable" : "burning",
    status: netMonthly >= 0 ? "The business is generating positive cash flow." : "The business is spending more than it earns.",
  };
}

async function getTaxSummary(ctx: FunctionContext, args: { year?: number; quarter?: number }) {
  // Tax REPORTING only — not advice
  const year = args.year || new Date().getFullYear();
  const now = new Date();

  let start: string, end: string;
  if (args.quarter) {
    const qStartMonth = (args.quarter - 1) * 3;
    start = new Date(year, qStartMonth, 1).toISOString().split("T")[0];
    end = new Date(year, qStartMonth + 3, 0).toISOString().split("T")[0];
  } else {
    start = new Date(year, 0, 1).toISOString().split("T")[0];
    end = new Date(year, 11, 31).toISOString().split("T")[0];
  }

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, cost_amount, profit, category_name, date")
    .eq("business_id", ctx.business_id)
    .gte("date", start)
    .lte("date", end);

  if (!data) return { income: 0, expenses: 0, net: 0, count: 0 };

  const income = sum(data.filter(t => t.type === "income"), "amount");
  const expenses = sum(data.filter(t => t.type === "expense"), "amount");
  const cost = sum(data.filter(t => t.type === "income"), "cost_amount");
  const profit = sum(data.filter(t => t.type === "income"), "profit");

  // Category breakdown for expenses
  const expenseCats: Record<string, number> = {};
  data.filter(t => t.type === "expense").forEach(t => {
    const cat = t.category_name || "Uncategorized";
    expenseCats[cat] = (expenseCats[cat] || 0) + Number(t.amount);
  });

  return {
    period: args.quarter ? `Q${args.quarter} ${year}` : `FY ${year}`,
    income,
    expenses,
    net: income - expenses,
    cost_of_goods: cost,
    gross_profit: profit,
    expense_categories: Object.entries(expenseCats).map(([k, v]) => ({ category: k, amount: v })).sort((a, b) => b.amount - a.amount),
    transaction_count: data.length,
    disclaimer: "This is a factual report of recorded transactions. Not tax advice — consult a qualified accountant for tax filing.",
  };
}

async function listProducts(ctx: FunctionContext, args: { limit?: number; active_only?: boolean }) {
  const limit = Math.min(args.limit || 20, 50);
  let query = supabase
    .from("products")
    .select("id, name, description, price, cost, category, unit, is_active")
    .eq("business_id", ctx.business_id)
    .order("name")
    .limit(limit);

  if (args.active_only !== false) query = query.eq("is_active", true);

  const { data } = await query;
  const products = (data || []).map(p => ({
    name: p.name,
    price: Number(p.price),
    cost: Number(p.cost || 0),
    margin: p.price > 0 ? Math.round((p.price - Number(p.cost || 0)) / p.price * 100) : 0,
    category: p.category,
    unit: p.unit,
    description: p.description,
    active: p.is_active,
  }));

  return { products, count: products.length };
}

async function listRecentTransactions(ctx: FunctionContext, args: { limit?: number; type?: string; period?: string }) {
  const limit = Math.min(args.limit || 10, 20);
  let query = supabase
    .from("transactions")
    .select("id, type, amount, description, client_name, vendor_name, category_name, payment_method, date")
    .eq("business_id", ctx.business_id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.type) query = query.eq("type", args.type);

  if (args.period) {
    const { start, end } = dateRange(args.period);
    query = query.gte("date", start).lte("date", end);
  }

  const { data } = await query;
  return { transactions: data || [], count: data?.length || 0 };
}

async function listRecentInvoices(ctx: FunctionContext, args: { limit?: number; status?: string }) {
  const limit = Math.min(args.limit || 10, 20);
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, status, issue_date, due_date, total, amount_paid, balance_due, items")
    .eq("business_id", ctx.business_id)
    .order("issue_date", { ascending: false })
    .limit(limit);

  if (args.status) query = query.eq("status", args.status);

  const { data: invoices } = await query;
  if (!invoices) return { invoices: [], count: 0 };

  // Enrich with customer names
  const customerIds = Array.from(new Set(invoices.map((i) => i.customer_id).filter(Boolean)));
  let customerMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds);
    customers?.forEach((c) => { customerMap[c.id] = c.name; });
  }

  return {
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer: customerMap[inv.customer_id] || "Unknown",
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total: inv.total,
      amount_paid: inv.amount_paid || 0,
      balance_due: inv.balance_due ?? inv.total,
      item_count: Array.isArray(inv.items) ? inv.items.length : 0,
    })),
    count: invoices.length,
  };
}

async function getInvoiceDetail(ctx: FunctionContext, args: { invoice_id?: string; invoice_number?: string }) {
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("business_id", ctx.business_id);

  if (args.invoice_id) query = query.eq("id", args.invoice_id);
  else if (args.invoice_number) query = query.eq("invoice_number", args.invoice_number);
  else return { error: "Provide invoice_id or invoice_number" };

  const { data: inv } = await query.maybeSingle();
  if (!inv) return { error: "Invoice not found" };

  let customerName = "Unknown";
  if (inv.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("name")
      .eq("id", inv.customer_id)
      .maybeSingle();
    customerName = cust?.name || "Unknown";
  }

  return {
    invoice_number: inv.invoice_number,
    customer: customerName,
    status: inv.status,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    items: inv.items,
    subtotal: inv.subtotal,
    total: inv.total,
    amount_paid: inv.amount_paid || 0,
    balance_due: inv.balance_due ?? inv.total,
    notes: inv.notes,
  };
}

async function getBusinessSnapshot(ctx: FunctionContext) {
  // All-in-one business health snapshot
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [txRes, invRes, overdueRes, custRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, date")
      .eq("business_id", ctx.business_id)
      .gte("date", thisMonthStart)
      .lte("date", today),
    supabase
      .from("invoices")
      .select("status, total, balance_due, due_date")
      .eq("business_id", ctx.business_id),
    supabase
      .from("invoices")
      .select("invoice_number, balance_due, due_date, customer_id")
      .eq("business_id", ctx.business_id)
      .in("status", ["sent", "partial", "overdue"])
      .lt("due_date", today),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business_id),
  ]);

  const txs = txRes.data || [];
  const income = sum(txs.filter((t) => t.type === "income"), "amount");
  const expenses = sum(txs.filter((t) => t.type === "expense"), "amount");

  const allInvoices = invRes.data || [];
  const totalReceivables = sum(allInvoices.filter((i) => ["sent", "partial", "overdue"].includes(i.status)), "balance_due");
  const paidCount = allInvoices.filter((i) => i.status === "paid").length;

  return {
    this_month: { income, expenses, net: income - expenses },
    receivables: { total: totalReceivables, overdue_count: overdueRes.data?.length || 0 },
    invoices: { total: allInvoices.length, paid: paidCount, outstanding: allInvoices.length - paidCount },
    customers: { total: custRes.count || 0 },
  };
}

// ============================================================
// WRITE FUNCTIONS (only called via executePendingAction after confirmation)
// ============================================================

// ============================================================
// ADDITIONAL WRITE FUNCTIONS — mirror web app capabilities
// ============================================================

async function createCustomer(ctx: FunctionContext, args: { name: string; email?: string; phone?: string; address?: string; notes?: string }) {
  if (!args.name) return { error: "Customer name is required" };
  // Check for existing (case-insensitive, trimmed)
  const { data: existing } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", ctx.business_id)
    .ilike("name", args.name.trim());
  if (existing && existing.length > 0) {
    return { error: "A customer with this name already exists", existing_customer: existing[0] };
  }
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: ctx.business_id,
      name: args.name.trim(),
      email: args.email || null,
      phone: args.phone || null,
      address: args.address || null,
      notes: args.notes || null,
    })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  return { success: true, customer: data };
}

async function createProduct(ctx: FunctionContext, args: { name: string; price: number; cost?: number; category?: string; unit?: string; description?: string }) {
  if (!args.name) return { error: "Product name is required" };
  if (args.price === undefined || args.price < 0) return { error: "Price is required" };
  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: ctx.business_id,
      name: args.name.trim(),
      price: args.price,
      cost: args.cost || 0,
      category: args.category || null,
      unit: args.unit || null,
      description: args.description || null,
      is_active: true,
    })
    .select("id, name, price, cost")
    .single();
  if (error) return { error: error.message };
  return { success: true, product: data };
}

async function updateProduct(ctx: FunctionContext, args: { product_id: string; name?: string; price?: number; cost?: number; category?: string; is_active?: boolean }) {
  if (!args.product_id) return { error: "Product ID is required" };
  const updates: any = {};
  if (args.name !== undefined) updates.name = args.name.trim();
  if (args.price !== undefined) updates.price = args.price;
  if (args.cost !== undefined) updates.cost = args.cost;
  if (args.category !== undefined) updates.category = args.category;
  if (args.is_active !== undefined) updates.is_active = args.is_active;
  if (Object.keys(updates).length === 0) return { error: "No updates provided" };
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", args.product_id)
    .eq("business_id", ctx.business_id)
    .select("id, name, price")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Product not found" };
  return { success: true, product: data };
}

async function deleteTransaction(ctx: FunctionContext, args: { transaction_id: string }) {
  if (!args.transaction_id) return { error: "Transaction ID is required" };
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, type, amount, client_name, description")
    .eq("id", args.transaction_id)
    .eq("business_id", ctx.business_id)
    .maybeSingle();
  if (txErr) return { error: txErr.message };
  if (!tx) return { error: "Transaction not found" };
  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", args.transaction_id)
    .eq("business_id", ctx.business_id);
  if (delErr) return { error: delErr.message };
  return { success: true, deleted: tx };
}

async function markInvoiceSent(ctx: FunctionContext, args: { invoice_id: string }) {
  if (!args.invoice_id) return { error: "Invoice ID is required" };
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", args.invoice_id)
    .eq("business_id", ctx.business_id)
    .select("id, invoice_number, status")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Invoice not found" };
  return { success: true, invoice: data };
}

async function deleteInvoice(ctx: FunctionContext, args: { invoice_id: string }) {
  if (!args.invoice_id) return { error: "Invoice ID is required" };
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, status")
    .eq("id", args.invoice_id)
    .eq("business_id", ctx.business_id)
    .maybeSingle();
  if (invErr) return { error: invErr.message };
  if (!inv) return { error: "Invoice not found" };
  if (inv.status === "paid") return { error: "Cannot delete a paid invoice — use the web app to reverse it" };
  // Delete linked payments first
  await supabase.from("payments").delete().eq("invoice_id", args.invoice_id).eq("business_id", ctx.business_id);
  await supabase.from("invoice_payments").delete().eq("invoice_id", args.invoice_id);
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", args.invoice_id)
    .eq("business_id", ctx.business_id);
  if (error) return { error: error.message };
  return { success: true, deleted: inv };
}

// ── NEW READ FUNCTIONS ─────────────────────────────────────────────────────

async function getBusinessProfile(ctx: FunctionContext) {
  const { data } = await supabase
    .from("businesses")
    .select("name, email, phone, address, website, currency, invoice_prefix, business_type, tax_id, cost_rate, cost_rate_label")
    .eq("id", ctx.business_id)
    .maybeSingle();
  if (!data) return { error: "Business not found" };
  return { business: data };
}

async function getReportsData(ctx: FunctionContext, args: { months?: number }) {
  const months = Math.min(args.months || 12, 24);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const fromStr = from.toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data } = await supabase
    .from("transactions")
    .select("type, amount, cost_amount, profit, date")
    .eq("business_id", ctx.business_id)
    .gte("date", fromStr)
    .lte("date", today)
    .order("date", { ascending: true });

  if (!data) return { months: [], summary: { income: 0, expenses: 0, profit: 0 } };

  // Group by month
  const byMonth: Record<string, { income: number; expenses: number; profit: number }> = {};
  for (const tx of data) {
    const monthKey = tx.date.substring(0, 7);
    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expenses: 0, profit: 0 };
    if (tx.type === "income") {
      byMonth[monthKey].income += Number(tx.amount);
      byMonth[monthKey].profit += Number(tx.profit || 0);
    } else {
      byMonth[monthKey].expenses += Number(tx.amount);
    }
  }

  const monthsArr = Object.entries(byMonth).map(([month, v]) => ({
    month,
    income: v.income,
    expenses: v.expenses,
    profit: v.profit,
    net: v.income - v.expenses,
  })).sort((a, b) => a.month.localeCompare(b.month));

  return {
    months: monthsArr,
    summary: {
      income: monthsArr.reduce((s, m) => s + m.income, 0),
      expenses: monthsArr.reduce((s, m) => s + m.expenses, 0),
      profit: monthsArr.reduce((s, m) => s + m.profit, 0),
    },
  };
}

export async function recordTransaction(
  ctx: FunctionContext,
  params: { type: string; amount: number; description?: string; client_name?: string; vendor_name?: string; category_name?: string; payment_method?: string; date?: string }
) {
  const { type, amount, description, client_name, vendor_name, category_name, payment_method, date } = params;
  const trimmedClientName = client_name?.trim() || null;
  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      business_id: ctx.business_id,
      type,
      client_name: trimmedClientName,
      vendor_name: vendor_name || null,
      description: description || null,
      amount: Number(amount),
      category_name: category_name || null,
      payment_method: payment_method || "cash",
      date: date || new Date().toISOString().split("T")[0],
    })
    .select("*")
    .single();
  if (error) throw error;

  if (type === "income" && trimmedClientName) {
    await supabase.rpc("upsert_customer_and_increment", {
      p_business_id: ctx.business_id,
      p_name: trimmedClientName,
      p_amount: Number(amount),
    });
  }
  return { transaction: tx };
}

export async function createInvoice(
  ctx: FunctionContext,
  params: { customer_name: string; items: Array<{ description: string; amount: number; quantity?: number }>; due_date?: string; notes?: string }
) {
  const { customer_name, items, due_date, notes } = params;

  const { data: biz } = await supabase
    .from("businesses")
    .select("invoice_prefix")
    .eq("id", ctx.business_id)
    .maybeSingle();
  const prefix = biz?.invoice_prefix || "INV";

  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("business_id", ctx.business_id);
  const num = (count || 0) + 1;
  const year = new Date().getFullYear();
  const invNumber = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

  let subtotal = 0;
  const processedItems = (items || []).map((item: any, idx: number) => {
    const qty = Number(item.quantity || 1);
    // Accept unit_price OR amount (LLM may use either depending on resolve_product output)
    const price = Number(item.unit_price ?? item.amount ?? item.price ?? 0);
    const lineTotal = qty * price;
    subtotal += lineTotal;
    return {
      name: item.description || item.name || "",
      description: item.description || item.name || "",
      quantity: qty,
      unit_price: price,
      total: lineTotal,
      sort_order: idx,
      ...(item.product_id ? { product_id: item.product_id } : {}),
      ...(item.cost != null ? { cost: Number(item.cost), unit_cost: Number(item.cost) } : {}),
    };
  });
  if (subtotal === 0 && processedItems.length === 0) {
    throw new Error("No invoice items provided — cannot create invoice with zero items.");
  }
  const total = subtotal;

  // Resolve or create customer first to get customer_id
  let customerId: string | null = null;
  if (customer_name) {
    const { data: custId } = await supabase.rpc("upsert_customer_and_increment", {
      p_business_id: ctx.business_id,
      p_name: customer_name.trim(),
      p_amount: total,
    });
    customerId = custId;
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      business_id: ctx.business_id,
      invoice_number: invNumber,
      customer_id: customerId,
      status: "draft",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: due_date || null,
      items: processedItems,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total,
      notes: notes || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  return { invoice, invoice_number: invNumber, total };
}

export async function recordPayment(
  ctx: FunctionContext,
  params: { invoice_id: string; amount: number; customer_name?: string; payment_method?: string; date?: string }
) {
  const { invoice_id, amount, customer_name, payment_method, date } = params;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total, amount_paid, balance_due, status, items")
    .eq("business_id", ctx.business_id)
    .eq("id", invoice_id)
    .maybeSingle();
  if (!invoice) return { error: "Invoice not found" };

  const newAmountPaid = Number(invoice.amount_paid || 0) + Number(amount);
  const newBalanceDue = Number(invoice.total) - newAmountPaid;
  const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

  await supabase
    .from("invoices")
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice_id)
    .eq("business_id", ctx.business_id);

  let clientName = customer_name;
  if (!clientName && invoice.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("name")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    clientName = cust?.name || null;
  }

  await supabase.from("transactions").insert({
    business_id: ctx.business_id,
    type: "income",
    client_name: clientName || `Invoice ${invoice.invoice_number}`,
    description: `Payment for ${invoice.invoice_number}`,
    amount: Number(amount),
    payment_method: payment_method || "cash",
    date: date || new Date().toISOString().split("T")[0],
    invoice_id: invoice_id,
  });

  return {
    invoice_id,
    invoice_number: invoice.invoice_number,
    amount_paid: newAmountPaid,
    balance_due: newBalanceDue,
    status: newStatus,
  };
}

// ============================================================
// PENDING ACTION EXECUTION
// ============================================================

export async function executePendingAction(
  ctx: FunctionContext,
  pendingData: { action_type: string; action_params: any }
): Promise<any> {
  switch (pendingData.action_type) {
    case "record_transaction": return recordTransaction(ctx, pendingData.action_params);
    case "create_invoice": return createInvoice(ctx, pendingData.action_params);
    case "record_payment": return recordPayment(ctx, pendingData.action_params);
    case "create_customer": return createCustomer(ctx, pendingData.action_params);
    case "create_product": return createProduct(ctx, pendingData.action_params);
    case "update_product": return updateProduct(ctx, pendingData.action_params);
    case "delete_transaction": return deleteTransaction(ctx, pendingData.action_params);
    case "mark_invoice_sent": return markInvoiceSent(ctx, pendingData.action_params);
    case "delete_invoice": return deleteInvoice(ctx, pendingData.action_params);
    default: return { error: `Unknown action type: ${pendingData.action_type}` };
  }
}

// ============================================================
// FUNCTION DEFINITIONS (OpenAI function calling schema)
// ============================================================

// READ functions — always available
export const readFunctionDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "resolve_customer",
      description: "Look up a customer by name. Returns the customer record if found, or indicates a new customer should be created.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The customer name to look up. ALWAYS call this before logging a transaction or creating an invoice that involves a customer." } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resolve_product",
      description: "Look up a product by name. Returns the product record if found (with price, cost, category), or indicates a new product should be created. ALWAYS call this before creating an invoice with product items.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "The product name to look up" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_revenue",
      description: "Get total revenue for a period. Returns income, cost, profit, and transaction count.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_expenses",
      description: "Get total expenses for a period, broken down by category.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_receivables",
      description: "Get all outstanding receivables — who owes the business money and how much.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_balance",
      description: "Get a specific customer's outstanding balance and unpaid invoices.",
      parameters: {
        type: "object",
        properties: { customer_name: { type: "string" } },
        required: ["customer_name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_daily_summary",
      description: "Get a daily financial summary — income, expenses, net cash.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today", "yesterday"] } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_weekly_summary",
      description: "Get a weekly financial summary with comparison to the previous week.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_overdue_invoices",
      description: "Check for overdue invoices and return the list.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_cash_flow",
      description: "Analyze cash flow for decision support. Returns current cash, expected receivables, monthly expense average.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_periods",
      description: "Compare two time periods.",
      parameters: {
        type: "object",
        properties: {
          period1: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] },
          period2: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "top_customers",
      description: "Get top customers by revenue for a period.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["this_month", "last_month", "this_year"], description: "Default to this_month if not specified. Never ask." } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_recent_transactions",
      description: "List the most recent transactions for the business. Use when the user asks to 'show', 'pull up', 'list', or 'see' transactions, payments, expenses, or income.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of transactions to return (default 10, max 20)" },
          type: { type: "string", enum: ["income", "expense"], description: "Filter by transaction type" },
          period: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"], description: "Filter by time period. Default to this_month if not specified." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_recent_invoices",
      description: "List the most recent invoices for the business. Use when the user asks to see, show, or list invoices.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of invoices to return (default 10, max 20)" },
          status: { type: "string", enum: ["draft", "sent", "partial", "paid", "overdue"], description: "Filter by invoice status" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_invoice_detail",
      description: "Get full details of a specific invoice by number or ID.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "The invoice UUID" },
          invoice_number: { type: "string", description: "The invoice number (e.g. INV-2026-0001)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_snapshot",
      description: "Get a full business health snapshot: this month income/expenses, total receivables, invoice stats, and customer count. Use when the user asks 'how is business?', 'what's going on?', or wants a general overview.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_customers",
      description: "List all customers sorted by total invoiced (highest first). Use when the user asks to see, show, or list customers/clients.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Max customers to return (default 15, max 50)" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_detail",
      description: "Get a full customer profile: contact info, total invoiced, outstanding balance, recent transactions, and recent invoices. Use when the user asks about a specific customer.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "The customer name (or partial name)" },
          customer_id: { type: "string", description: "The customer UUID" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_transactions",
      description: "Search transactions by text, amount range, type, or date range. Use when the user asks to 'find', 'search', or 'look for' specific transactions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (matches description, client name, vendor, category)" },
          min_amount: { type: "number", description: "Minimum amount" },
          max_amount: { type: "number", description: "Maximum amount" },
          type: { type: "string", enum: ["income", "expense"] },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          limit: { type: "number", description: "Max results (default 15, max 30)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_receivables_aging",
      description: "Get receivables aging report — buckets outstanding invoices by how overdue they are (current, 1-30, 31-60, 61-90, 90+ days). Use when the user asks about aging, late invoices, or how overdue things are.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_expense_breakdown",
      description: "Get a detailed expense breakdown by category for a period. Shows total per category, percentage, and top items. Use when the user asks 'where did my money go?' or wants expense categories.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_profit_analysis",
      description: "Analyze profit margins — overall or by customer. Shows revenue, cost, profit, and margin. Use when the user asks about profitability, margins, or which customers are most profitable.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "yesterday", "this_month", "last_month", "this_week", "last_week", "this_year"] },
          by: { type: "string", enum: ["customer"], description: "Break down by customer" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_financial_health",
      description: "Get a comprehensive financial health score (A-F grade) based on revenue trend, profit margin, receivables, and burn rate. Use when the user asks 'how healthy is my business?' or wants an overall assessment.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_burn_rate",
      description: "Calculate the monthly burn rate (average expenses) and compare to income. Shows if the business is profitable or burning cash. Use when the user asks about burn rate, runway, or cash flow sustainability.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tax_summary",
      description: "Get a factual tax summary report (income, expenses, net, cost of goods, expense categories) for a year or quarter. REPORTING ONLY — not tax advice. Use when the user asks for a quarterly or annual summary for tax purposes.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "The year (e.g. 2026)" },
          quarter: { type: "number", enum: [1, 2, 3, 4], description: "The quarter (1-4)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_products",
      description: "List products/services with prices, costs, and margins. Use when the user asks to see, show, or list products, services, or prices.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max products (default 20, max 50)" },
          active_only: { type: "boolean", description: "Only active products (default true)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_profile",
      description: "Get the business profile: name, contact info, currency, invoice prefix, business type, tax ID, cost rate settings. Use when user asks about their business settings or profile.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_reports_data",
      description: "Get monthly financial data for charts and reports — income, expenses, profit, and net per month for the last N months. Use when the user asks about trends, reports, or wants to see data over time.",
      parameters: {
        type: "object",
        properties: { months: { type: "number", description: "Number of months to show (default 12, max 24)" } },
      },
    },
  },
];

// preview_action — available when there is NO pending action (phase 1)
export const previewActionDefinition = {
  type: "function" as const,
  function: {
    name: "preview_action",
    description: "Show a preview of a write action to the user. The user must confirm before the action is executed. ALWAYS call this before any write — never execute writes directly. Format the preview_text as a clear summary the user can confirm or edit.",
    parameters: {
      type: "object",
      properties: {
        action_type: { type: "string", enum: ["record_transaction", "create_invoice", "record_payment", "create_customer", "create_product", "update_product", "delete_transaction", "mark_invoice_sent", "delete_invoice"] },
        action_params: {
          type: "object",
          description: "The exact parameters that will be passed to the write function when confirmed",
          properties: {
            type: { type: "string", enum: ["income", "expense"] },
            amount: { type: "number" },
            description: { type: "string" },
            client_name: { type: "string" },
            vendor_name: { type: "string" },
            category_name: { type: "string" },
            payment_method: { type: "string" },
            date: { type: "string" },
            customer_name: { type: "string" },
            items: {
              type: "array",
              description: "Invoice line items. Each item must have description, unit_price (or amount), and optionally quantity and product_id.",
              items: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Item name/description" },
                  unit_price: { type: "number", description: "Unit price of the item (use this, not 'amount')" },
                  amount: { type: "number", description: "Alias for unit_price — accepted but prefer unit_price" },
                  quantity: { type: "number", description: "Quantity (default 1)" },
                  product_id: { type: "string", description: "Product ID if resolved from product catalog" },
                  cost: { type: "number", description: "Unit cost (optional, from product catalog)" },
                },
                required: ["description", "unit_price"],
              },
            },
            due_date: { type: "string" },
            notes: { type: "string" },
            invoice_id: { type: "string" },
            product_id: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            transaction_id: { type: "string" },
            is_active: { type: "boolean" },
            cost: { type: "number" },
            category: { type: "string" },
            unit: { type: "string" },
          },
        },
        preview_text: { type: "string", description: "The formatted preview message to show the user. Include all fields clearly. End with: Reply 'confirm' to proceed or 'edit' to change." },
      },
      required: ["action_type", "action_params", "preview_text"],
    },
  },
};

// execute_pending_action — available when there IS a pending action (phase 2)
export const executePendingActionDefinition = {
  type: "function" as const,
  function: {
    name: "execute_pending_action",
    description: "Execute the pending action that the user has confirmed. Call this when the user says 'confirm', 'yes', 'ok', 'proceed', or similar confirmation. Do NOT call this if the user wants to edit or change something.",
    parameters: { type: "object", properties: {} },
  },
};

// ============================================================
// FUNCTION DISPATCHER
// ============================================================

export async function executeReadFunction(
  name: string,
  args: any,
  ctx: FunctionContext
): Promise<any> {
  switch (name) {
    case "resolve_customer": return resolveCustomer(ctx, args.name);
    case "resolve_product": return resolveProduct(ctx, args.name);
    case "query_revenue": return queryRevenue(ctx, args.period);
    case "query_expenses": return queryExpenses(ctx, args.period);
    case "query_receivables": return queryReceivables(ctx);
    case "get_customer_balance": return getCustomerBalance(ctx, args.customer_name);
    case "get_daily_summary": return getDailySummary(ctx, args.period);
    case "get_weekly_summary": return getWeeklySummary(ctx);
    case "check_overdue_invoices": return checkOverdueInvoices(ctx);
    case "analyze_cash_flow": return analyzeCashFlow(ctx);
    case "compare_periods": return comparePeriods(ctx, args.period1, args.period2);
    case "top_customers": return topCustomers(ctx, args.period);
    case "list_recent_transactions": return listRecentTransactions(ctx, args);
    case "list_recent_invoices": return listRecentInvoices(ctx, args);
    case "get_invoice_detail": return getInvoiceDetail(ctx, args);
    case "get_business_snapshot": return getBusinessSnapshot(ctx);
    case "list_customers": return listCustomers(ctx, args);
    case "get_customer_detail": return getCustomerDetail(ctx, args);
    case "search_transactions": return searchTransactions(ctx, args);
    case "get_receivables_aging": return getReceivablesAging(ctx);
    case "get_expense_breakdown": return getExpenseBreakdown(ctx, args);
    case "get_profit_analysis": return getProfitAnalysis(ctx, args);
    case "get_financial_health": return getFinancialHealth(ctx);
    case "get_burn_rate": return getBurnRate(ctx);
    case "get_tax_summary": return getTaxSummary(ctx, args);
    case "list_products": return listProducts(ctx, args);
    case "get_business_profile": return getBusinessProfile(ctx);
    case "get_reports_data": return getReportsData(ctx, args);
    default: return { error: `Unknown function: ${name}` };
  }
}
