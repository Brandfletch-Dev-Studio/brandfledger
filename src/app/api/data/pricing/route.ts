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
      // Read from profiles table (where Paychangu activation writes to)
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, subscription_ends_at, plan')
        .eq('id', user.userId)
        .maybeSingle();

      if (profile) {
        const status = profile.subscription_status || "trial";
        const now = new Date();
        let daysLeft = 0;

        if (status === "trial" && profile.trial_ends_at) {
          daysLeft = Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }

        let access: "active" | "trial" | "expired" = "expired";
        if (status === "active" && (!profile.subscription_ends_at || new Date(profile.subscription_ends_at) > now)) {
          access = "active";
        } else if (status === "trial" && profile.trial_ends_at && new Date(profile.trial_ends_at) > now) {
          access = "trial";
        }

        subscription = {
          status: access,
          daysLeft,
          trialEndsAt: profile.trial_ends_at,
          subscriptionEndsAt: profile.subscription_ends_at,
          plan: profile.plan,
        };
      }
    }

    return NextResponse.json({ pricing, subscription });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
