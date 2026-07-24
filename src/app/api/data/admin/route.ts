import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_EMAIL = "geniuspulse22@gmail.com";

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");

    if (section === "overview") {
      const [businesses, transactions, products, customers, invoices] = await Promise.all([
        query("SELECT id, name, currency, subscription_status, created_at FROM businesses ORDER BY created_at DESC", []),
        query("SELECT amount, type FROM transactions", []),
        query("SELECT COUNT(*) as count FROM products", []),
        query("SELECT COUNT(*) as count FROM customers", []),
        query("SELECT total, status FROM invoices", []),
      ]);

      const totalRevenue = transactions
        .filter((t: any) => t.type === "income")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const paidInvoices = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total), 0);

      return NextResponse.json({
        stats: {
          businesses: businesses.length,
          totalRevenue,
          totalTransactions: transactions.length,
          totalProducts: parseInt(products[0]?.count || "0"),
          totalClients: parseInt(customers[0]?.count || "0"),
          paidInvoices,
          totalInvoices: invoices.length,
        },
        businesses,
      });
    }

    if (section === "users") {
      const users = await query(
        `SELECT DISTINCT b.owner_id, b.name as business_name, b.subscription_status, b.created_at
         FROM businesses b ORDER BY b.created_at DESC`,
        []
      );
      return NextResponse.json({ users });
    }

    if (section === "pricing") {
      let pricing = null;
      try {
        const rows = await query("SELECT value FROM platform_settings WHERE key = $1", ["pricing"]);
        if (rows.length > 0) pricing = rows[0].value;
      } catch {}
      return NextResponse.json({ pricing });
    }

    if (section === "businesses") {
      const businesses = await query(
        `SELECT b.id, b.name, b.currency, b.subscription_status, b.trial_ends_at, b.subscription_ends_at, b.created_at,
         (SELECT COUNT(*) FROM transactions WHERE business_id = b.id) as tx_count,
         (SELECT COUNT(*) FROM customers WHERE business_id = b.id) as cust_count,
         (SELECT COUNT(*) FROM products WHERE business_id = b.id) as prod_count
         FROM businesses b ORDER BY b.created_at DESC`,
        []
      );
      return NextResponse.json({ businesses });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json();
    const { action, ...data } = body;

    if (action === "update_pricing") {
      // Upsert pricing in platform_settings
      await query(
        `INSERT INTO platform_settings (key, value) VALUES ('pricing', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [JSON.stringify(data.pricing)]
      );
      return NextResponse.json({ success: true });
    }

    if (action === "extend_trial") {
      const { business_id, days } = data;
      await query(
        `UPDATE businesses SET trial_ends_at = trial_ends_at + INTERVAL '1 day' * $1 WHERE id = $2`,
        [days, business_id]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
