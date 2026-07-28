import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_EMAIL = "geniuspulse22@gmail.com";
function isAdmin(user: { email: string }) {
  return user.email.toLowerCase() === ADMIN_EMAIL;
}

async function getUsersMap() {
  const map: Record<string, { email: string; name: string }> = {};
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: usersData, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !usersData?.users?.length) break;
    for (const u of usersData.users) {
      const meta = (u.user_metadata as any) || {};
      const rawMeta = (u.raw_user_meta_data as any) || {};
      // Try every possible key Supabase or OAuth providers might use
      const name =
        meta.full_name ||
        meta.name ||
        rawMeta.full_name ||
        rawMeta.name ||
        u.email?.split("@")[0] ||
        "";
      map[u.id] = { email: u.email || "", name };
    }
    if (usersData.users.length < perPage) break;
    page++;
  }
  return map;
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
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();

      const [accounts, businesses, subscriptions, expiredAccounts] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('businesses').select('id, owner_id, created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('subscriptions').select('plan, amount, status').eq('status', 'active'),
        supabase.from('accounts').select('*').eq('subscription_status', 'expired').gte('updated_at', sevenDaysAgo),
      ]);

      const accountList = accounts.data || [];
      const subMap: Record<string, number> = {};
      for (const a of accountList) {
        const s = a.subscription_status || "trial";
        subMap[s] = (subMap[s] || 0) + 1;
      }

      const churnCount = (expiredAccounts.data || []).length;
      const subRows = subscriptions.data || [];
      let monthlyRev = 0, annualRev = 0, totalRev = 0;
      for (const s of subRows) {
        const amt = Number(s.amount || 0);
        totalRev += amt;
        if (s.plan === "monthly") monthlyRev += amt;
        else if (s.plan === "annual") annualRev += amt;
      }

      // Pending renewals: active subs expiring in next 7 days
      const { data: activeAccounts } = await supabase
        .from('accounts')
        .select('user_id, subscription_ends_at')
        .eq('subscription_status', 'active')
        .not('subscription_ends_at', 'is', null);

      const usersMap = await getUsersMap();
      const pendingRenewals = (activeAccounts || [])
        .filter(a => {
          if (!a.subscription_ends_at) return false;
          const ends = new Date(a.subscription_ends_at);
          return ends > now && ends <= new Date(now.getTime() + 7 * 86400_000);
        })
        .map(a => ({
          user_id: a.user_id,
          email: usersMap[a.user_id]?.email || "",
          name: usersMap[a.user_id]?.name || "",
          subscription_ends_at: a.subscription_ends_at,
          days_left: Math.ceil((new Date(a.subscription_ends_at!).getTime() - now.getTime()) / 86400000),
        }));

      const recentExpired = (expiredAccounts.data || []).map(a => ({
        user_id: a.user_id,
        email: usersMap[a.user_id]?.email || "",
        name: usersMap[a.user_id]?.name || "",
        trial_ends_at: a.trial_ends_at,
        updated_at: a.updated_at,
      }));

      // Avg subscription duration (active subs only)
      let totalSubDays = 0, activeCount = 0;
      for (const a of accountList) {
        if (a.subscription_status === "active" && a.created_at) {
          const days = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86400000);
          totalSubDays += days;
          activeCount++;
        }
      }
      const avgSubDuration = activeCount > 0 ? Math.round(totalSubDays / activeCount) : 0;

      // Trial-to-paid conversion rate
      const totalEverSubscribed = (subMap["active"] ?? 0) + (subMap["expired"] ?? 0);
      const conversionRate = accountList.length > 0
        ? ((totalEverSubscribed / accountList.length) * 100).toFixed(1)
        : "0.0";

      return NextResponse.json({
        stats: {
          totalAccounts: accountList.length,
          activeSubscribers: subMap["active"] ?? 0,
          trialUsers: subMap["trial"] ?? 0,
          expiredUsers: subMap["expired"] ?? 0,
          newThisMonth: (businesses.data || []).length,
          churnLast30Days: churnCount,
          pendingRenewals: pendingRenewals.length,
          totalRevenue: totalRev,
          monthlyRevenue: monthlyRev,
          annualRevenue: annualRev,
          totalPayments: subRows.length,
          avgSubDurationDays: avgSubDuration,
          conversionRate: parseFloat(conversionRate),
        },
        pendingRenewals,
        recentExpired,
        expiredAccounts: recentExpired,
      });
    }

    if (section === "users") {
      const [accounts, businesses] = await Promise.all([
        supabase.from('accounts').select('*'),
        supabase.from('businesses').select('id, owner_id, name, created_at').order('created_at', { ascending: false }),
      ]);

      const usersMap = await getUsersMap();
      const bizByOwner: Record<string, any> = {};
      for (const b of (businesses.data || [])) {
        if (!bizByOwner[b.owner_id]) bizByOwner[b.owner_id] = b;
      }

      const users = (accounts.data || []).map(a => {
        const biz = bizByOwner[a.user_id];
        const now = new Date();

        // Calculate subscription duration
        let subDurationDays: number | null = null;
        if (a.subscription_status === "active" && a.subscription_ends_at) {
          // For active subs, duration = from start (estimated from end - plan period) to now
          // If we have created_at, use that; otherwise estimate from end date
          const subStart = a.created_at ? new Date(a.created_at) : null;
          if (subStart) {
            subDurationDays = Math.floor((now.getTime() - subStart.getTime()) / 86400000);
          }
        } else if (a.subscription_status === "trial" && a.trial_ends_at) {
          subDurationDays = Math.floor((now.getTime() - new Date(a.trial_ends_at).getTime() + 14 * 86400000) / 86400000);
        }

        // Days left in trial or subscription
        let daysLeft: number | null = null;
        if (a.subscription_status === "trial" && a.trial_ends_at) {
          daysLeft = Math.ceil((new Date(a.trial_ends_at).getTime() - now.getTime()) / 86400000);
        } else if (a.subscription_status === "active" && a.subscription_ends_at) {
          daysLeft = Math.ceil((new Date(a.subscription_ends_at).getTime() - now.getTime()) / 86400000);
        }

        return {
          user_id: a.user_id,
          email: usersMap[a.user_id]?.email || "",
          name: usersMap[a.user_id]?.name || "",
          subscription_status: a.subscription_status || "trial",
          trial_ends_at: a.trial_ends_at,
          subscription_ends_at: a.subscription_ends_at,
          plan: a.plan,
          business_name: biz?.name || null,
          created_at: a.created_at || biz?.created_at || null,
          sub_duration_days: subDurationDays,
          days_left: daysLeft,
        };
      });

      return NextResponse.json({ users });
    }

    if (section === "pricing") {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'pricing').maybeSingle();
      return NextResponse.json({ pricing: data?.value || null });
    }

    if (section === "businesses") {
      const [businesses, accounts] = await Promise.all([
        supabase.from('businesses').select('id, name, currency, created_at, owner_id').order('created_at', { ascending: false }),
        supabase.from('accounts').select('user_id, subscription_status, trial_ends_at, subscription_ends_at'),
      ]);

      const usersMap = await getUsersMap();
      const acctMap: Record<string, any> = {};
      for (const a of (accounts.data || [])) {
        acctMap[a.user_id] = a;
      }

      // Get counts per business
      const [txCounts, custCounts, prodCounts] = await Promise.all([
        supabase.from('transactions').select('business_id'),
        supabase.from('customers').select('business_id'),
        supabase.from('products').select('business_id'),
      ]);

      const txMap: Record<string, number> = {};
      for (const t of (txCounts.data || [])) {
        txMap[t.business_id] = (txMap[t.business_id] || 0) + 1;
      }
      const custMap: Record<string, number> = {};
      for (const c of (custCounts.data || [])) {
        custMap[c.business_id] = (custMap[c.business_id] || 0) + 1;
      }
      const prodMap: Record<string, number> = {};
      for (const p of (prodCounts.data || [])) {
        prodMap[p.business_id] = (prodMap[p.business_id] || 0) + 1;
      }

      const bizList = (businesses.data || []).map(b => {
        const a = acctMap[b.owner_id];
        const now = new Date();

        // Subscription duration
        let subDurationDays: number | null = null;
        if (a?.subscription_status === "active") {
          const subStart = a?.created_at ? new Date(a.created_at) : new Date(b.created_at);
          subDurationDays = Math.floor((now.getTime() - subStart.getTime()) / 86400000);
        } else if (a?.subscription_status === "trial" && a?.trial_ends_at) {
          subDurationDays = Math.floor((14 * 86400000 - (new Date(a.trial_ends_at).getTime() - now.getTime())) / 86400000);
        }

        // Days left
        let daysLeft: number | null = null;
        if (a?.subscription_status === "trial" && a?.trial_ends_at) {
          daysLeft = Math.ceil((new Date(a.trial_ends_at).getTime() - now.getTime()) / 86400000);
        } else if (a?.subscription_status === "active" && a?.subscription_ends_at) {
          daysLeft = Math.ceil((new Date(a.subscription_ends_at).getTime() - now.getTime()) / 86400000);
        }

        return {
          id: b.id,
          name: b.name,
          currency: b.currency,
          created_at: b.created_at,
          subscription_status: a?.subscription_status || null,
          trial_ends_at: a?.trial_ends_at || null,
          subscription_ends_at: a?.subscription_ends_at || null,
          plan: a?.plan || null,
          owner_email: usersMap[b.owner_id]?.email || "",
          owner_name: usersMap[b.owner_id]?.name || "",
          account_created_at: a?.created_at || null,
          sub_duration_days: subDurationDays,
          days_left: daysLeft,
          tx_count: txMap[b.id] || 0,
          cust_count: custMap[b.id] || 0,
          prod_count: prodMap[b.id] || 0,
        };
      });

      return NextResponse.json({ businesses: bizList });
    }

    if (section === "settings") {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['paychangu_configured', 'resend_configured']);

      const status: Record<string, boolean> = {};
      for (const row of (data || [])) {
        status[row.key.replace("_configured", "")] = !!(row.value as any)?.configured;
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
          html: `<p>Hi ${name || "there"},</p><p>We noticed your Brandfledger subscription has lapsed. Your data is safe — we just wanted to reach out.</p><p>Upgrade now to regain full access:</p><p><a href="https://brandfledger-three.vercel.app/subscription" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Upgrade Now</a></p><p>— The Brandfledger Team</p>`,
        }),
      });
      return NextResponse.json({ success: true });
    }

    if (section === "settings") {
      const { paychangu_secret_key, paychangu_webhook_secret, resend_api_key } = body;
      const upserts: { key: string; value: any }[] = [];
      if (paychangu_secret_key?.trim()) {
        upserts.push({ key: 'paychangu_secret_key', value: { encoded: Buffer.from(paychangu_secret_key.trim()).toString("base64") } });
        upserts.push({ key: 'paychangu_configured', value: { configured: true } });
      }
      if (paychangu_webhook_secret?.trim()) {
        upserts.push({ key: 'paychangu_webhook_secret', value: { encoded: Buffer.from(paychangu_webhook_secret.trim()).toString("base64") } });
      }
      if (resend_api_key?.trim()) {
        upserts.push({ key: 'resend_api_key', value: { encoded: Buffer.from(resend_api_key.trim()).toString("base64") } });
        upserts.push({ key: 'resend_configured', value: { configured: true } });
      }
      for (const u of upserts) {
        await supabase.from('platform_settings').upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
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
      await supabase.from('platform_settings').upsert({ key: 'pricing', value: data.pricing, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    if (action === "extend_trial") {
      const { user_id, days } = data;
      const { data: account } = await supabase.from('accounts').select('trial_ends_at').eq('user_id', user_id).maybeSingle();
      const currentEnd = account?.trial_ends_at ? new Date(account.trial_ends_at) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(baseDate.getTime() + days * 86400000).toISOString();
      await supabase.from('accounts').update({
        trial_ends_at: newEnd,
        subscription_status: 'trial',
        updated_at: new Date().toISOString(),
      }).eq('user_id', user_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getResendKey(): Promise<string | null> {
  try {
    const { data } = await supabase.from('platform_settings').select('value').eq('key', 'resend_api_key').maybeSingle();
    if (data?.value?.encoded) return Buffer.from(data.value.encoded, "base64").toString();
  } catch {}
  return process.env.RESEND_API_KEY || null;
}

