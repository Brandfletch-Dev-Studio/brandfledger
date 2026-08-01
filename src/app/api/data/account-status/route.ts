import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch from accounts table (one row per user)
    let { data: account, error: accError } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, subscription_ends_at, plan')
      .eq('id', user.userId)
      .maybeSingle();
    if (accError) throw accError;

    // If no profile row exists yet, create a default trial (safety net)
    if (!account) {
      const trialEndsAt = new Date(Date.now() + 14 * 86400_000).toISOString();
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.userId,
          email: user.email,
          subscription_status: 'trial',
          trial_ends_at: trialEndsAt,
        });
      if (insertError && insertError.code !== '23505') {
        // Profile might have been created by trigger — try fetching again
        const { data: refetched } = await supabase
          .from('profiles')
          .select('subscription_status, trial_ends_at, subscription_ends_at, plan')
          .eq('id', user.userId)
          .maybeSingle();
        account = refetched;
      } else {
        const { data: refetched } = await supabase
          .from('profiles')
          .select('subscription_status, trial_ends_at, subscription_ends_at, plan')
          .eq('id', user.userId)
          .maybeSingle();
        account = refetched;
      }
    }

    if (!account) {
      throw new Error("Account row not found and could not be created");
    }

    const now = new Date();
    let accessStatus: "active" | "trial" | "expired" = "expired";

    if (account.subscription_status === "active") {
      if (!account.subscription_ends_at || new Date(account.subscription_ends_at) > now) {
        accessStatus = "active";
      }
    } else if (account.subscription_status === "trial") {
      if (account.trial_ends_at && new Date(account.trial_ends_at) > now) {
        accessStatus = "trial";
      }
    }

    const daysLeft = account.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(account.trial_ends_at).getTime() - now.getTime()) / 86400_000))
      : 0;

    return NextResponse.json({
      subscription_status: account.subscription_status,
      access: accessStatus,
      trial_ends_at: account.trial_ends_at,
      subscription_ends_at: account.subscription_ends_at,
      plan: account.plan,
      days_left: daysLeft,
    });
  } catch (err: any) {
    // Fail open — don't lock users out on DB errors
    return NextResponse.json({ access: "trial", error: err.message });
  }
}
