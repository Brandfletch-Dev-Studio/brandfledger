import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("Signature") || req.headers.get("signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const { data: webhookRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paychangu_webhook_secret")
      .maybeSingle();

    const WEBHOOK_SECRET = webhookRow?.value?.encoded
      ? Buffer.from(webhookRow.value.encoded, "base64").toString("utf-8")
      : process.env.PAYCHANGU_WEBHOOK_SECRET || "";

    const computedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (event === "payment.success") {
      // Paychangu may send tx_ref OR charge_id depending on payment method
      const ref = data?.tx_ref || data?.charge_id || data?.reference;
      if (!ref) return NextResponse.json({ received: true, matched: false });

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("paychangu_tx_ref", ref)
        .maybeSingle();

      if (sub && sub.status !== "active") {
        const endDate =
          sub.plan === "annual"
            ? new Date(Date.now() + 365 * 86400000).toISOString()
            : new Date(Date.now() + 30 * 86400000).toISOString();
        const now = new Date().toISOString();

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            paychangu_tx_id: data.tx_id || data.tx_ref || ref,
            end_date: endDate,
            updated_at: now,
          })
          .eq("id", sub.id);

        const { data: biz } = await supabase
          .from("businesses")
          .select("owner_id")
          .eq("id", sub.business_id)
          .maybeSingle();

        if (biz?.owner_id) {
          await supabase
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_ends_at: endDate,
              updated_at: now,
            })
            .eq("id", biz.owner_id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
