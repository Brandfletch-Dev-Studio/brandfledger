import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getBusinessId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const { data, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", requestedId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return requestedId;
  }
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

function toCSV(rows: any[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `"${c.label}"`).join(",");
  const lines = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return "";
      const str = typeof val === "string" ? val.replace(/"/g, '""') : String(val);
      return `"${str}"`;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "transactions";
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { data: business, error: businessErr } = await supabase
      .from("businesses")
      .select("name, currency")
      .eq("id", businessId)
      .maybeSingle();

    if (businessErr) throw businessErr;
    const bizName = business?.name || "Business";
    const currency = business?.currency || "MWK";

    let csv = "";
    let filename = "";

    if (type === "transactions") {
      const { data: transactions, error: txErr } = await supabase
        .from("transactions")
        .select("date, type, client_name, vendor_name, description, amount, cost_amount, profit, margin, payment_method, category_id, product_id")
        .eq("business_id", businessId)
        .order("date", { ascending: false });

      if (txErr) throw txErr;

      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from("categories").select("id, name").eq("business_id", businessId),
        supabase.from("products").select("id, name").eq("business_id", businessId),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      const categoryMap = new Map(categoriesRes.data?.map(c => [c.id, c.name]));
      const productMap = new Map(productsRes.data?.map(p => [p.id, p.name]));

      const rows = (transactions || []).map(t => ({
        ...t,
        category_name: t.category_id ? categoryMap.get(t.category_id) || null : null,
        product_name: t.product_id ? productMap.get(t.product_id) || null : null,
      }));

      csv = toCSV(rows, [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "client_name", label: "Client" },
        { key: "vendor_name", label: "Vendor" },
        { key: "description", label: "Description" },
        { key: "category_name", label: "Category" },
        { key: "product_name", label: "Product" },
        { key: "amount", label: `Amount (${currency})` },
        { key: "cost_amount", label: `Cost (${currency})` },
        { key: "profit", label: `Profit (${currency})` },
        { key: "margin", label: "Margin %" },
        { key: "payment_method", label: "Payment Method" },
      ]);
      filename = `${bizName}_transactions_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (type === "customers") {
      const { data: rows, error: customersErr } = await supabase
        .from("customers")
        .select("name, email, phone, address, notes, total_invoiced, created_at")
        .eq("business_id", businessId)
        .order("name");

      if (customersErr) throw customersErr;

      csv = toCSV(rows || [], [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "address", label: "Address" },
        { key: "total_invoiced", label: `Total Invoiced (${currency})` },
        { key: "notes", label: "Notes" },
        { key: "created_at", label: "Created" },
      ]);
      filename = `${bizName}_customers_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (type === "products") {
      const { data: products, error: productsErr } = await supabase
        .from("products")
        .select("name, description, price, cost, profit_margin, is_active, category_id, created_at")
        .eq("business_id", businessId)
        .order("name");

      if (productsErr) throw productsErr;

      const { data: categories, error: categoriesErr } = await supabase
        .from("categories")
        .select("id, name")
        .eq("business_id", businessId);

      if (categoriesErr) throw categoriesErr;

      const categoryMap = new Map(categories?.map(c => [c.id, c.name]));

      const rows = (products || []).map(p => ({
        ...p,
        category_name: p.category_id ? categoryMap.get(p.category_id) || null : null,
      }));

      csv = toCSV(rows, [
        { key: "name", label: "Name" },
        { key: "description", label: "Description" },
        { key: "category_name", label: "Category" },
        { key: "price", label: `Price (${currency})` },
        { key: "cost", label: `Cost (${currency})` },
        { key: "profit_margin", label: "Margin %" },
        { key: "is_active", label: "Active" },
        { key: "created_at", label: "Created" },
      ]);
      filename = `${bizName}_products_${new Date().toISOString().split("T")[0]}.csv`;
    } else if (type === "summary") {
      const [incomeRes, expensesRes, productsRes, customersRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("business_id", businessId).eq("type", "income").order("date", { ascending: false }),
        supabase.from("transactions").select("*").eq("business_id", businessId).eq("type", "expense").order("date", { ascending: false }),
        supabase.from("products").select("*").eq("business_id", businessId).order("name"),
        supabase.from("customers").select("*").eq("business_id", businessId).order("name"),
      ]);

      if (incomeRes.error) throw incomeRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (customersRes.error) throw customersRes.error;

      const income = incomeRes.data || [];
      const expenses = expensesRes.data || [];
      const products = productsRes.data || [];
      const customers = customersRes.data || [];

      const totalRev = income.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalCost = income.reduce((s: number, t: any) => s + Number(t.cost_amount || 0), 0);
      const totalExp = expenses.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const grossProfit = totalRev - totalCost;
      const netProfit = grossProfit - totalExp;

      const summaryRows = [
        { metric: "Business", value: bizName },
        { metric: "Currency", value: currency },
        { metric: "Report Date", value: new Date().toISOString().split("T")[0] },
        { metric: "", value: "" },
        { metric: "Total Revenue", value: `${currency} ${totalRev}` },
        { metric: "Cost of Sales", value: `${currency} ${totalCost}` },
        { metric: "Gross Profit", value: `${currency} ${grossProfit}` },
        { metric: "Total Expenses", value: `${currency} ${totalExp}` },
        { metric: "Net Profit", value: `${currency} ${netProfit}` },
        { metric: "", value: "" },
        { metric: "Income Transactions", value: income.length },
        { metric: "Expense Transactions", value: expenses.length },
        { metric: "Products", value: products.length },
        { metric: "Customers", value: customers.length },
      ];

      csv = toCSV(summaryRows, [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ]);
      filename = `${bizName}_summary_${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
