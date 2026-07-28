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
// WRITE FUNCTIONS (only called via executePendingAction after confirmation)
// ============================================================

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
  const processedItems = items.map((item, idx) => {
    const qty = item.quantity || 1;
    const price = item.amount;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    return { name: item.description, description: item.description, quantity: qty, unit_price: price, total: lineTotal, sort_order: idx };
  });
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
        properties: { name: { type: "string", description: "The customer name to look up" } },
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
        properties: { period: { type: "string", enum: ["this_month", "last_month", "this_year"] } },
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
        action_type: { type: "string", enum: ["record_transaction", "create_invoice", "record_payment"] },
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
            items: { type: "array", items: { type: "object" } },
            due_date: { type: "string" },
            notes: { type: "string" },
            invoice_id: { type: "string" },
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
    default: return { error: `Unknown function: ${name}` };
  }
}
