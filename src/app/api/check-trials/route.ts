import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called by Vercel Cron daily at 7am UTC
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const nowStr = now.toISOString();

    // 1. Find accounts where trial is about to expire (1, 3, 5 days out) — send reminders
    const { data: accounts, error: accountsErr } = await supabase
      .from("accounts")
      .select("user_id, trial_ends_at")
      .eq("subscription_status", "trial")
      .gt("trial_ends_at", nowStr);

    if (accountsErr) throw accountsErr;

    const matchingAccounts = (accounts || []).filter(acc => {
      const trialEnds = new Date(acc.trial_ends_at);
      const diffTime = trialEnds.getTime() - now.getTime();
      const daysLeft = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return [1, 3, 5].includes(daysLeft);
    });

    const warningRows = [];
    for (const acc of matchingAccounts) {
      try {
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(acc.user_id);
        if (!userErr && userData?.user) {
          const user = userData.user;
          const fullName = user.user_metadata?.full_name || null;
          const email = user.email;
          const trialEnds = new Date(acc.trial_ends_at);
          const daysLeft = Math.floor((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          warningRows.push({
            user_id: acc.user_id,
            email,
            full_name: fullName,
            trial_ends_at: acc.trial_ends_at,
            days_left: daysLeft
          });
        }
      } catch {}
    }

    // Send reminder emails via Resend (if configured)
    const resendKey = await getResendKey();
    let emailsSent = 0;

    if (resendKey) {
      for (const row of warningRows) {
        const daysLeft = Math.ceil(Number(row.days_left));
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Brandfledger <no-reply@brandfledger.com>",
              to: [row.email],
              subject: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
              html: `
                <p>Hi ${row.full_name || "there"},</p>
                <p>Your Brandfledger free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
                <p>Upgrade now to keep access to all your data and features:</p>
                <p><a href="https://brandfledger-three.vercel.app/subscription" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Upgrade Now</a></p>
                <p>Your data is safe — it will never be deleted.</p>
                <p>— The Brandfledger Team</p>
              `,
            }),
          });
          emailsSent++;
        } catch {}
      }
    }

    // 2. Expire accounts whose trial has ended
    const { data: expired, error: expireErr } = await supabase
      .from("accounts")
      .update({ subscription_status: "expired", updated_at: nowStr })
      .eq("subscription_status", "trial")
      .lt("trial_ends_at", nowStr)
      .select("user_id");

    if (expireErr) throw expireErr;

    // 3. Expire active subscriptions that have run out
    const { error: activeExpireErr } = await supabase
      .from("accounts")
      .update({ subscription_status: "expired", updated_at: nowStr })
      .eq("subscription_status", "active")
      .not("subscription_ends_at", "is", null)
      .lt("subscription_ends_at", nowStr);

    if (activeExpireErr) throw activeExpireErr;

    return NextResponse.json({
      success: true,
      reminders_sent: emailsSent,
      trials_expired: expired ? expired.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getResendKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "resend_api_key")
      .limit(1)
      .maybeSingle();
    if (data?.value) return Buffer.from(data.value, "base64").toString();
  } catch {}
  return process.env.RESEND_API_KEY || null;
}
