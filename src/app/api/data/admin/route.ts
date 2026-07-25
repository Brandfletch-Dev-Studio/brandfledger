import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_EMAIL = "geniuspulse22@gmail.com";

function isAdmin(user: { email: string }) {
  return user.email.toLowerCase() === ADMIN_EMAIL;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");

    if (section === "overview") {
      const [businesses, revenueRows, customers] = await Promise.all([
        query("SELECT id, name, currency, subscription_status, created_at FROM businesses ORDER BY created_at DESC", []),
        query("SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM transactions WHERE type = 'income'", []),
        query("SELECT COUNT(*) as count FROM customers", []),
      ]);

      return NextResponse.json({
        stats: {
          businesses: businesses.length,
          totalRevenue: parseFloat(revenueRows[0]?.total || "0"),
          totalTransactions: parseInt(revenueRows[0]?.count || "0"),
          totalClients: parseInt(customers[0]?.count || "0"),
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

    if (section === "settings") {
      // Return status of configured credentials (never return the actual keys)
      const rows = await query("SELECT key, value FROM platform_settings WHERE key IN ('paychangu_configured','resend_configured')", []);
      const status: Record<string, boolean> = {};
      for (const row of rows) {
        status[row.key.replace("_configured", "")] = !!row.value?.configured;
      }
      return NextResponse.json({ status: { paychangu_configured: !!status.paychangu, resend_configured: !!status.resend } });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json();
    const { section } = body;

    if (section === "settings") {
      const { paychangu_secret_key, paychangu_webhook_secret, resend_api_key } = body;

      // Store credentials encrypted in platform_settings (base64 — not production crypto, but better than env-only)
      // In a real production system you'd use a KMS; for now we store obfuscated in DB
      if (paychangu_secret_key?.trim()) {
        const encoded = Buffer.from(paychangu_secret_key.trim()).toString("base64");
        await query(
          `INSERT INTO platform_settings (key, value) VALUES ('paychangu_secret_key', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify({ encoded })]
        );
        await query(
          `INSERT INTO platform_settings (key, value) VALUES ('paychangu_configured', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify({ configured: true })]
        );
      }

      if (paychangu_webhook_secret?.trim()) {
        const encoded = Buffer.from(paychangu_webhook_secret.trim()).toString("base64");
        await query(
          `INSERT INTO platform_settings (key, value) VALUES ('paychangu_webhook_secret', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify({ encoded })]
        );
      }

      if (resend_api_key?.trim()) {
        const encoded = Buffer.from(resend_api_key.trim()).toString("base64");
        await query(
          `INSERT INTO platform_settings (key, value) VALUES ('resend_api_key', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify({ encoded })]
        );
        await query(
          `INSERT INTO platform_settings (key, value) VALUES ('resend_configured', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify({ configured: true })]
        );
      }

      return NextResponse.json({ success: true });
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
    if (!isAdmin(user)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json();
    const { action, ...data } = body;

    if (action === "update_pricing") {
      await query(
        `INSERT INTO platform_settings (key, value) VALUES ('pricing', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
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
