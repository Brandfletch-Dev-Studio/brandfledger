import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called by Vercel Cron daily at 7am UTC
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Find accounts where trial is about to expire (1, 3, 5 days out) — send reminders
    const warningRows = await query(`
      SELECT a.user_id, u.email, u.raw_user_meta_data->>'full_name' as full_name,
             a.trial_ends_at,
             EXTRACT(DAY FROM a.trial_ends_at - now()) as days_left
      FROM accounts a
      JOIN auth.users u ON u.id = a.user_id
      WHERE a.subscription_status = 'trial'
        AND a.trial_ends_at IS NOT NULL
        AND a.trial_ends_at > now()
        AND EXTRACT(DAY FROM a.trial_ends_at - now()) IN (1, 3, 5)
    `);

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
    const expired = await query(`
      UPDATE accounts
      SET subscription_status = 'expired', updated_at = NOW()
      WHERE subscription_status = 'trial'
        AND trial_ends_at < NOW()
      RETURNING user_id
    `);

    // 3. Expire active subscriptions that have run out
    await query(`
      UPDATE accounts
      SET subscription_status = 'expired', updated_at = NOW()
      WHERE subscription_status = 'active'
        AND subscription_ends_at IS NOT NULL
        AND subscription_ends_at < NOW()
    `);

    return NextResponse.json({
      success: true,
      reminders_sent: emailsSent,
      trials_expired: expired.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getResendKey(): Promise<string | null> {
  try {
    const rows = await query(
      "SELECT value FROM platform_settings WHERE key = 'resend_api_key' LIMIT 1"
    );
    if (rows[0]?.value) return Buffer.from(rows[0].value, "base64").toString();
  } catch {}
  return process.env.RESEND_API_KEY || null;
}
