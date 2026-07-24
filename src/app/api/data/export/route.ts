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

    const business = await query("SELECT name, currency FROM businesses WHERE id = $1", [businessId]);
    const bizName = business[0]?.name || "Business";
    const currency = business[0]?.currency || "MWK";

    let csv = "";
    let filename = "";

    if (type === "transactions") {
      const rows = await query(
        `SELECT t.date, t.type, t.client_name, t.vendor_name, t.description, t.amount, t.cost_amount, t.profit, t.margin, t.payment_method, c.name as category_name, p.name as product_name
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN products p ON p.id = t.product_id
         WHERE t.business_id = $1
         ORDER BY t.date DESC`,
        [businessId]
      );
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
      const rows = await query(
        `SELECT c.name, c.email, c.phone, c.address, c.notes, c.total_invoiced, c.created_at
         FROM customers c
         WHERE c.business_id = $1
         ORDER BY c.name`,
        [businessId]
      );
      csv = toCSV(rows, [
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
      const rows = await query(
        `SELECT p.name, p.description, p.price, p.cost, p.profit_margin, p.is_active, c.name as category_name, p.created_at
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.business_id = $1
         ORDER BY p.name`,
        [businessId]
      );
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
      // Full business summary report
      const [income, expenses, products, customers] = await Promise.all([
        query("SELECT * FROM transactions WHERE business_id = $1 AND type = 'income' ORDER BY date DESC", [businessId]),
        query("SELECT * FROM transactions WHERE business_id = $1 AND type = 'expense' ORDER BY date DESC", [businessId]),
        query("SELECT * FROM products WHERE business_id = $1 ORDER BY name", [businessId]),
        query("SELECT * FROM customers WHERE business_id = $1 ORDER BY name", [businessId]),
      ]);

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
