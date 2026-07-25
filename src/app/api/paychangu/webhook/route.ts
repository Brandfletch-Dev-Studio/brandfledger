import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("Signature") || req.headers.get("signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Read from DB or env
    const webhookRows = await query("SELECT value FROM platform_settings WHERE key = 'paychangu_webhook_secret'");
    const WEBHOOK_SECRET = webhookRows[0]?.value?.encoded
      ? Buffer.from(webhookRows[0].value.encoded, "base64").toString("utf-8")
      : (process.env.PAYCHANGU_WEBHOOK_SECRET || "");
    const computedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event_type === "api.charge.payment" && payload.status === "success") {
      const txRef = payload.reference || payload.tx_ref;

      // Verify with API
      const secretRows = await query("SELECT value FROM platform_settings WHERE key = 'paychangu_secret_key'");
      const PAYCHANGU_SECRET = secretRows[0]?.value?.encoded
        ? Buffer.from(secretRows[0].value.encoded, "base64").toString("utf-8")
        : (process.env.PAYCHANGU_SECRET_KEY || "");
      const verifyRes = await fetch(`https://api.paychangu.com/verify-payment/${txRef}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        },
      });

      const verifyResult = await verifyRes.json();

      if (verifyRes.ok && verifyResult.data?.status === "success") {
        const subs = await query("SELECT * FROM subscriptions WHERE paychangu_tx_ref = $1", [txRef]);
        const sub = subs[0];

        if (sub && sub.status !== "active") {
          const endDate = sub.plan === "annual"
            ? new Date(Date.now() + 365 * 86400000)
            : new Date(Date.now() + 30 * 86400000);

          await query(
            `UPDATE subscriptions SET status = 'active', paychangu_tx_id = $1, end_date = $2, updated_at = now() WHERE id = $3`,
            [verifyResult.data?.tx_id || txRef, endDate, sub.id]
          );

          await query(
            `UPDATE businesses SET subscription_status = 'active', subscription_ends_at = $1 WHERE id = $2`,
            [endDate, sub.business_id]
          );
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
