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
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();
      const sevenDaysAgo  = new Date(now.getTime() -  7 * 86400_000).toISOString();

      const [
        accountRows,
        subRows,
        newThisMonthRows,
        churnRows,
        pendingRenewalRows,
        expiredRows,
        revenueRows,
        recentExpiredRows,
      ] = await Promise.all([
        // Total unique user accounts
        query(`SELECT COUNT(DISTINCT owner_id) as count FROM businesses`, []),
        // Subscription breakdown
        query(`
          SELECT subscription_status, COUNT(*) as count
          FROM accounts
          GROUP BY subscription_status
        `, []),
        // New signups last 30 days
        query(`SELECT COUNT(*) as count FROM businesses WHERE created_at >= $1`, [thirtyDaysAgo]),
        // Churned in last 30 days: went from active/trial to expired
        query(`SELECT COUNT(*) as count FROM accounts WHERE subscription_status = 'expired' AND updated_at >= $1`, [thirtyDaysAgo]),
        // Pending renewals: active subs expiring in next 7 days
        query(`
          SELECT a.user_id, u.email, u.raw_user_meta_data->>'full_name' as name,
                 a.subscription_ends_at,
                 EXTRACT(DAY FROM a.subscription_ends_at - now()) as days_left
          FROM accounts a
          JOIN auth.users u ON u.id = a.user_id
          WHERE a.subscription_status = 'active'
            AND a.subscription_ends_at IS NOT NULL
            AND a.subscription_ends_at > now()
            AND a.subscription_ends_at <= now() + INTERVAL '7 days'
          ORDER BY a.subscription_ends_at ASC
        `, []),
        // Recently expired (last 7 days) — candidates for manual reminder
        query(`
          SELECT a.user_id, u.email, u.raw_user_meta_data->>'full_name' as name,
                 a.trial_ends_at, a.updated_at
          FROM accounts a
          JOIN auth.users u ON u.id = a.user_id
          WHERE a.subscription_status = 'expired'
            AND a.updated_at >= $1
          ORDER BY a.updated_at DESC
          LIMIT 20
        `, [sevenDaysAgo]),
        // Platform subscription revenue (from subscriptions table)
        query(`
          SELECT
            COALESCE(SUM(CASE WHEN plan = 'monthly' THEN amount ELSE 0 END), 0) as monthly_revenue,
            COALESCE(SUM(CASE WHEN plan = 'annual'  THEN amount ELSE 0 END), 0) as annual_revenue,
            COALESCE(SUM(amount), 0) as total_revenue,
            COUNT(*) as total_payments
          FROM subscriptions
          WHERE status = 'active'
        `, []),
        // All expired accounts for the expired users list
        query(`
          SELECT a.user_id, u.email, u.raw_user_meta_data->>'full_name' as name,
                 a.trial_ends_at, a.updated_at,
                 b.name as business_name
          FROM accounts a
          JOIN auth.users u ON u.id = a.user_id
          LEFT JOIN businesses b ON b.owner_id = a.user_id
          WHERE a.subscription_status = 'expired'
          ORDER BY a.updated_at DESC
          LIMIT 30
        `, []),
      ]);

      // Parse subscription breakdown
      const subMap: Record<string, number> = {};
      for (const row of subRows) {
        subMap[row.subscription_status] = parseInt(row.count);
      }

      return NextResponse.json({
        stats: {
          totalAccounts:    parseInt(accountRows[0]?.count ?? "0"),
          activeSubscribers: subMap["active"]  ?? 0,
          trialUsers:        subMap["trial"]   ?? 0,
          expiredUsers:      subMap["expired"] ?? 0,
          newThisMonth:      parseInt(newThisMonthRows[0]?.count ?? "0"),
          churnLast30Days:   parseInt(churnRows[0]?.count ?? "0"),
          pendingRenewals:   pendingRenewalRows.length,
          totalRevenue:      parseFloat(revenueRows[0]?.total_revenue ?? "0"),
          monthlyRevenue:    parseFloat(revenueRows[0]?.monthly_revenue ?? "0"),
          annualRevenue:     parseFloat(revenueRows[0]?.annual_revenue ?? "0"),
          totalPayments:     parseInt(revenueRows[0]?.total_payments ?? "0"),
        },
        pendingRenewals: pendingRenewalRows,
        recentExpired:   recentExpiredRows,
        expiredAccounts: recentExpiredRows,
      });
    }

    if (section === "users") {
      const users = await query(
        `SELECT a.user_id, u.email, u.raw_user_meta_data->>'full_name' as name,
                a.subscription_status, a.trial_ends_at, a.subscription_ends_at, a.plan,
                b.name as business_name, b.created_at
         FROM accounts a
         JOIN auth.users u ON u.id = a.user_id
         LEFT JOIN businesses b ON b.owner_id = a.user_id
         ORDER BY b.created_at DESC`,
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
        `SELECT b.id, b.name, b.currency, b.created_at,
                a.subscription_status, a.trial_ends_at, a.subscription_ends_at,
                u.email as owner_email,
                (SELECT COUNT(*) FROM transactions WHERE business_id = b.id) as tx_count,
                (SELECT COUNT(*) FROM customers WHERE business_id = b.id) as cust_count,
                (SELECT COUNT(*) FROM products WHERE business_id = b.id) as prod_count
         FROM businesses b
         LEFT JOIN accounts a ON a.user_id = b.owner_id
         LEFT JOIN auth.users u ON u.id = b.owner_id
         ORDER BY b.created_at DESC`,
        []
      );
      return NextResponse.json({ businesses });
    }

    if (section === "settings") {
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
    const { section, action } = body;

    // Manual reminder email to an expired/trial user
    if (action === "send_reminder") {
      const { user_id, email, name } = body;
      const resendKey = await getResendKey();
      if (!resendKey) return NextResponse.json({ error: "Resend not configured" }, { status: 400 });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Brandfledger <no-reply@brandfledger.com>",
          to: [email],
          subject: "Your Brandfledger account — quick note",
          html: `
            <p>Hi ${name || "there"},</p>
            <p>We noticed your Brandfledger subscription has lapsed. Your data is safe — we just wanted to reach out.</p>
            <p>Upgrade now to regain full access:</p>
            <p><a href="https://brandfledger-three.vercel.app/subscription" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Upgrade Now</a></p>
            <p>— The Brandfledger Team</p>
          `,
        }),
      });
      return NextResponse.json({ success: true });
    }

    if (section === "settings") {
      const { paychangu_secret_key, paychangu_webhook_secret, resend_api_key } = body;
      if (paychangu_secret_key?.trim()) {
        const encoded = Buffer.from(paychangu_secret_key.trim()).toString("base64");
        await query(`INSERT INTO platform_settings (key, value) VALUES ('paychangu_secret_key', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify({ encoded })]);
        await query(`INSERT INTO platform_settings (key, value) VALUES ('paychangu_configured', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify({ configured: true })]);
      }
      if (paychangu_webhook_secret?.trim()) {
        const encoded = Buffer.from(paychangu_webhook_secret.trim()).toString("base64");
        await query(`INSERT INTO platform_settings (key, value) VALUES ('paychangu_webhook_secret', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify({ encoded })]);
      }
      if (resend_api_key?.trim()) {
        const encoded = Buffer.from(resend_api_key.trim()).toString("base64");
        await query(`INSERT INTO platform_settings (key, value) VALUES ('resend_api_key', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify({ encoded })]);
        await query(`INSERT INTO platform_settings (key, value) VALUES ('resend_configured', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [JSON.stringify({ configured: true })]);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
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
        `INSERT INTO platform_settings (key, value) VALUES ('pricing', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(data.pricing)]
      );
      return NextResponse.json({ success: true });
    }

    if (action === "extend_trial") {
      const { user_id, days } = data;
      await query(
        `UPDATE accounts SET
           trial_ends_at = GREATEST(trial_ends_at, NOW()) + INTERVAL '1 day' * $1,
           subscription_status = 'trial',
           updated_at = NOW()
         WHERE user_id = $2`,
        [days, user_id]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getResendKey(): Promise<string | null> {
  try {
    const rows = await query("SELECT value FROM platform_settings WHERE key = 'resend_api_key' LIMIT 1", []);
    if (rows[0]?.value?.encoded) return Buffer.from(rows[0].value.encoded, "base64").toString();
  } catch {}
  return process.env.RESEND_API_KEY || null;
}
