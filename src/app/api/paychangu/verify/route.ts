import { NextRequest, NextResponse } from "next/server";
import { getDbUser, supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!data?.value?.encoded) return null;
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  } catch { return null; }
}

async function activateSubscription(sub: any) {
  const endDate = sub.plan === "annual"
    ? new Date(Date.now() + 365 * 86400000).toISOString()
    : new Date(Date.now() + 30 * 86400000).toISOString();

  await supabase.from("subscriptions").update({
    status: "active",
    end_date: endDate,
    updated_at: new Date().toISOString(),
  }).eq("id", sub.id);

  const { data: biz } = await supabase
    .from("businesses").select("owner_id").eq("id", sub.business_id).maybeSingle();
  if (biz?.owner_id) {
    await supabase.from("profiles").update({
      subscription_status: "active",
      subscription_ends_at: endDate,
      updated_at: new Date().toISOString(),
    }).eq("id", biz.owner_id);
  }
}

async function cancelSubscription(sub: any) {
  await supabase.from("subscriptions").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", sub.id);
}

export async function GET(req: NextRequest) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const chargeId = searchParams.get("charge_id");
    if (!chargeId) return NextResponse.json({ error: "charge_id required" }, { status: 400 });

    // Check our DB first
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("paychangu_tx_ref", chargeId)
      .maybeSingle();

    if (sub) {
      // Already resolved by webhook
      if (sub.status === "active") return NextResponse.json({ status: "success", chargeId });
      if (sub.status === "cancelled") return NextResponse.json({ status: "failed", chargeId, reason: "cancelled" });

      // Auto-cancel if older than 15 minutes
      const createdAt = new Date(sub.created_at || sub.start_date).getTime();
      const ageMinutes = (Date.now() - createdAt) / 60000;
      if (ageMinutes > 15) {
        await cancelSubscription(sub);
        return NextResponse.json({ status: "failed", chargeId, reason: "timeout" });
      }
    }

    if (sub?.status === "pending") {
      const PAYCHANGU_SECRET =
        (await getCredential("paychangu_secret_key")) ||
        process.env.PAYCHANGU_SECRET_KEY || "";

      // PRIMARY: Direct Charge verify endpoint
      // CORRECT URL: /mobile-money/payments/{chargeId}/verify (NOT /status)
      try {
        const verifyRes = await fetch(
          `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (verifyRes.ok) {
          const result = await verifyRes.json();
          const returnedRef = result?.data?.charge_id || result?.data?.tx_ref || result?.data?.reference || "";
          const paychanguStatus = result?.data?.status || result?.status || "pending";

          // Cross-business guard: only trust if returned ref matches our chargeId
          const refMatches = !returnedRef || returnedRef === chargeId;

          if (refMatches && (paychanguStatus === "successful" || paychanguStatus === "success")) {
            await activateSubscription(sub);
            return NextResponse.json({ status: "success", chargeId });
          }

          if (refMatches && (paychanguStatus === "failed" || paychanguStatus === "cancelled")) {
            await cancelSubscription(sub);
            return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
          }
        }
      } catch {
        // Direct charge endpoint failed — try fallback
      }

      // FALLBACK: Generic verify-payment endpoint
      try {
        const fallbackRes = await fetch(
          `https://api.paychangu.com/verify-payment/${encodeURIComponent(chargeId)}`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (fallbackRes.ok) {
          const fbResult = await fallbackRes.json();
          const fbStatus = fbResult?.data?.status || fbResult?.status || "pending";
          const fbRef = fbResult?.data?.tx_ref || fbResult?.data?.charge_id || "";
          const fbRefMatches = !fbRef || fbRef === chargeId;

          if (fbRefMatches && (fbStatus === "successful" || fbStatus === "success")) {
            await activateSubscription(sub);
            return NextResponse.json({ status: "success", chargeId });
          }

          if (fbRefMatches && (fbStatus === "failed" || fbStatus === "cancelled")) {
            await cancelSubscription(sub);
            return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
          }
        }
      } catch {
        // Both endpoints unreachable — stay pending, client will retry
      }

      return NextResponse.json({ status: "pending", chargeId });
    }

    return NextResponse.json({ status: "pending", chargeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
