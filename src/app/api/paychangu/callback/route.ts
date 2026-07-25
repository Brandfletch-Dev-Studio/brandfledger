import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txRef = searchParams.get("tx_ref");
    const status = searchParams.get("status");

    if (!txRef) {
      return NextResponse.redirect(new URL("/subscription?status=error", req.url));
    }

    // Verify payment with Paychangu
    const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY || "sec_test_NmI2ZDk4NjFlMzI0NDBlNjBiZWM3YzA2YjExZDM5NjY5MjY4NDQ3Yz";

    const verifyRes = await fetch(`https://api.paychangu.com/verify-payment/${txRef}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
      },
    });

    const verifyResult = await verifyRes.json();

    if (verifyRes.ok && verifyResult.status === "success" && verifyResult.data?.status === "success") {
      // Payment confirmed — activate subscription
      const subs = await query("SELECT * FROM subscriptions WHERE paychangu_tx_ref = $1", [txRef]);
      const sub = subs[0];

      if (sub) {
        const plan = sub.plan;
        const endDate = plan === "annual"
          ? new Date(Date.now() + 365 * 86400000)
          : new Date(Date.now() + 30 * 86400000);

        await query(
          `UPDATE subscriptions SET status = 'active', paychangu_tx_id = $1, end_date = $2, updated_at = now() WHERE id = $3`,
          [verifyResult.data?.tx_id || txRef, endDate, sub.id]
        );

        // Update account-level subscription (one per user, covers all their businesses)
        await query(
          `UPDATE accounts SET subscription_status = 'active', subscription_ends_at = $1, updated_at = NOW()
           WHERE user_id = (SELECT owner_id FROM businesses WHERE id = $2 LIMIT 1)`,
          [endDate, sub.business_id]
        );

        return NextResponse.redirect(new URL("/subscription?status=success", req.url));
      }
    }

    return NextResponse.redirect(new URL("/subscription?status=failed", req.url));
  } catch (err: any) {
    return NextResponse.redirect(new URL("/subscription?status=error", req.url));
  }
}
