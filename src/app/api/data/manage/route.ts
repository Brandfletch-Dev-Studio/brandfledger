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
  // Check cookie for active business selection
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const cookieId = cookieStore.get("activeBusinessId")?.value;
    if (cookieId) {
      const ownership = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2", [cookieId, userId]);
      if (ownership.length > 0) return cookieId;
    }
  } catch {}
  const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [userId]);
  return businesses[0]?.id ?? null;
}

// GET — return data counts for each table
export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const [transactions, customers, products, categories, invoices] = await Promise.all([
      query("SELECT COUNT(*) as count FROM transactions WHERE business_id = $1", [businessId]),
      query("SELECT COUNT(*) as count FROM customers WHERE business_id = $1", [businessId]),
      query("SELECT COUNT(*) as count FROM products WHERE business_id = $1", [businessId]),
      query("SELECT COUNT(*) as count FROM categories WHERE business_id = $1", [businessId]),
      query("SELECT COUNT(*) as count FROM invoices WHERE business_id = $1", [businessId]),
    ]);

    return NextResponse.json({
      counts: {
        transactions: parseInt(transactions[0].count),
        customers: parseInt(customers[0].count),
        products: parseInt(products[0].count),
        categories: parseInt(categories[0].count),
        invoices: parseInt(invoices[0].count),
      },
      businessId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — clear data by table, or all
export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all";
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const deleted: Record<string, number> = {};

    if (scope === "all" || scope === "transactions") {
      const r = await query("DELETE FROM transactions WHERE business_id = $1", [businessId]);
      deleted.transactions = r.length || 0;
    }
    if (scope === "all" || scope === "invoices") {
      // Invoices store items as JSONB — no separate invoice_items table
      const r = await query("DELETE FROM invoices WHERE business_id = $1", [businessId]);
      deleted.invoices = r.length || 0;
    }
    if (scope === "all" || scope === "customers") {
      const r = await query("DELETE FROM customers WHERE business_id = $1", [businessId]);
      deleted.customers = r.length || 0;
    }
    if (scope === "all" || scope === "products") {
      const r = await query("DELETE FROM products WHERE business_id = $1", [businessId]);
      deleted.products = r.length || 0;
    }
    if (scope === "all" || scope === "categories") {
      const r = await query("DELETE FROM categories WHERE business_id = $1", [businessId]);
      deleted.categories = r.length || 0;
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
