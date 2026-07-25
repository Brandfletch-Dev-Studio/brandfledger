import { NextResponse } from "next/server";
import { getDbUser, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch from accounts table (one row per user)
    let rows = await query(
      "SELECT subscription_status, trial_ends_at, subscription_ends_at, plan FROM accounts WHERE user_id = $1",
      [user.userId]
    );

    // If no account row exists yet, auto-create it (handles legacy users)
    if (rows.length === 0) {
      // Check if user has a business with trial info
      const bizRows = await query(
        "SELECT subscription_status, trial_ends_at, subscription_ends_at FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1",
        [user.userId]
      );
      const biz = bizRows[0];
      const status = biz?.subscription_status || "trial";
      const trialEndsAt = biz?.trial_ends_at || new Date(Date.now() + 14 * 86400_000).toISOString();

      await query(
        `INSERT INTO accounts (user_id, subscription_status, trial_ends_at, subscription_ends_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.userId, status, trialEndsAt, biz?.subscription_ends_at || null]
      );

      rows = await query(
        "SELECT subscription_status, trial_ends_at, subscription_ends_at, plan FROM accounts WHERE user_id = $1",
        [user.userId]
      );
    }

    const account = rows[0];
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
