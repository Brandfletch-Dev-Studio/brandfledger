import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

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

    // Get pricing from platform_settings
    let pricing = DEFAULT_PRICING;
    try {
      const rows = await query("SELECT value FROM platform_settings WHERE key = $1", ["pricing"]);
      if (rows.length > 0 && rows[0].value) {
        pricing = { ...DEFAULT_PRICING, ...rows[0].value };
      }
    } catch {
      // table might not exist yet, use defaults
    }

    // Get business subscription status if authenticated
    let subscription = null;
    if (user) {
      const businesses = await query("SELECT subscription_status, trial_ends_at, subscription_ends_at FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
      if (businesses.length > 0) {
        const biz = businesses[0];
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
