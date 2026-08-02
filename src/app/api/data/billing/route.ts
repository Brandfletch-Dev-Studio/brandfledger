import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Get profile / subscription status
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at, subscription_ends_at, plan, full_name, email")
      .eq("id", user.userId)
      .maybeSingle();

    // 2. Get all subscription records (payment history)
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.userId);

    const businessIds = businesses?.map(b => b.id) || [];
    let paymentHistory: any[] = [];
    let currentSubscription: any = null;

    if (businessIds.length > 0) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("*")
        .in("business_id", businessIds)
        .order("created_at", { ascending: false });

      if (subs) {
        paymentHistory = subs;
        // Find the current active subscription
        currentSubscription = subs.find((s: any) => s.status === "active") || null;
      }
    }

    // 3. Get pricing config
    const { data: pricingRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "pricing")
      .maybeSingle();

    const DEFAULT_PRICING = {
      monthly_rate: 15000,
      annual_rate: 150000,
      currency: "MWK",
      trial_days: 14,
      features: [
        "Unlimited invoices",
        "Unlimited businesses",
        "Profit tracking",
        "Team members",
        "Reports & exports",
        "Priority support",
      ],
    };
    const pricing = { ...DEFAULT_PRICING, ...(pricingRow?.value || {}) };

    // 4. Compute access status
    const now = new Date();
    let access: "active" | "trial" | "expired" = "expired";
    let daysLeft = 0;

    if (profile?.subscription_status === "active") {
      if (!profile.subscription_ends_at || new Date(profile.subscription_ends_at) > now) {
        access = "active";
        if (profile.subscription_ends_at) {
          daysLeft = Math.ceil((new Date(profile.subscription_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    } else if (profile?.subscription_status === "trial" || !profile?.subscription_status) {
      const trialEnds = profile?.trial_ends_at || new Date(Date.now() + 14 * 86400000).toISOString();
      if (new Date(trialEnds) > now) {
        access = "trial";
        daysLeft = Math.max(0, Math.ceil((new Date(trialEnds).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    // 5. Get usage stats
    let usage = { businesses: 0, invoices: 0, transactions: 0, teamMembers: 0 };
    if (businessIds.length > 0) {
      const [invRes, txRes, memberRes] = await Promise.all([
        supabase.from("invoices").select("id", { count: "exact", head: true }).in("business_id", businessIds),
        supabase.from("transactions").select("id", { count: "exact", head: true }).in("business_id", businessIds),
        supabase.from("business_members").select("id", { count: "exact", head: true }).in("business_id", businessIds),
      ]);
      usage = {
        businesses: businessIds.length,
        invoices: invRes.count || 0,
        transactions: txRes.count || 0,
        teamMembers: memberRes.count || 0,
      };
    }

    return NextResponse.json({
      profile: profile || null,
      access,
      daysLeft,
      pricing,
      currentSubscription,
      paymentHistory: paymentHistory.map((s: any) => ({
        id: s.id,
        plan: s.plan,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        created_at: s.created_at,
        start_date: s.start_date,
        end_date: s.end_date,
        paychangu_tx_ref: s.paychangu_tx_ref,
      })),
      usage,
      businesses: businesses || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    if (action === "cancel") {
      // Find current active subscription
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, owner_id")
        .eq("owner_id", user.userId);

      const businessIds = businesses?.map(b => b.id) || [];
      if (businessIds.length === 0) {
        return NextResponse.json({ error: "No business found" }, { status: 404 });
      }

      const { data: activeSub } = await supabase
        .from("subscriptions")
        .select("*")
        .in("business_id", businessIds)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeSub) {
        return NextResponse.json({ error: "No active subscription to cancel" }, { status: 404 });
      }

      // Mark as cancelled (access continues until end_date)
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", activeSub.id);

      // Update profile — keep subscription_ends_at so access continues
      // but mark as cancelled so it won't auto-renew
      await supabase
        .from("profiles")
        .update({ subscription_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", user.userId);

      return NextResponse.json({ success: true, message: "Subscription cancelled" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
