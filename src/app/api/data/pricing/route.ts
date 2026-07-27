import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: Request) {
  try {
    const user = getDbUser();

    let pricing = DEFAULT_PRICING;
    try {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'pricing').maybeSingle();
      if (data?.value) {
        pricing = { ...DEFAULT_PRICING, ...data.value };
      }
    } catch {}

    let subscription = null;
    if (user) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('subscription_status, trial_ends_at, subscription_ends_at')
        .eq('owner_id', user.userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (biz) {
        const status = biz.subscription_status || "trial";
        let daysLeft = 0;
        if (status === "trial" && biz.trial_ends_at) {
          daysLeft = Math.ceil((new Date(biz.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
        subscription = {
          status,
          daysLeft,
          trialEndsAt: biz.trial_ends_at,
          subscriptionEndsAt: biz.subscription_ends_at,
        };
      }
    }

    return NextResponse.json({ pricing, subscription });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
