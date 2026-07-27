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

    if (event === "payment.success" && data?.tx_ref) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("paychangu_tx_ref", data.tx_ref)
        .maybeSingle();

      if (sub) {
        const endDate =
          sub.plan === "annual"
            ? new Date(Date.now() + 365 * 86400000).toISOString()
            : new Date(Date.now() + 30 * 86400000).toISOString();

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            paychangu_tx_id: data.tx_id || data.tx_ref,
            end_date: endDate,
          })
          .eq("id", sub.id);

        const { data: biz } = await supabase
          .from("businesses")
          .select("owner_id")
          .eq("id", sub.business_id)
          .maybeSingle();

        if (biz?.owner_id) {
          await supabase
            .from("accounts")
            .update({
              subscription_status: "active",
              subscription_ends_at: endDate,
            })
            .eq("user_id", biz.owner_id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
