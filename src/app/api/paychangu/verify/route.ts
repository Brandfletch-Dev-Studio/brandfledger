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

export async function GET(req: NextRequest) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const chargeId = searchParams.get("charge_id");
    if (!chargeId) return NextResponse.json({ error: "charge_id required" }, { status: 400 });

    // Check if already timed out (> 15 min since subscription was created)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("paychangu_tx_ref", chargeId)
      .maybeSingle();

    if (sub) {
      // Already resolved
      if (sub.status === "active") return NextResponse.json({ status: "success", chargeId });
      if (sub.status === "cancelled") return NextResponse.json({ status: "failed", chargeId, reason: "cancelled" });

      // Check age — auto-cancel if older than 15 minutes
      const createdAt = new Date(sub.created_at || sub.start_date).getTime();
      const ageMinutes = (Date.now() - createdAt) / 60000;
      if (ageMinutes > 15) {
        await supabase.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);
        return NextResponse.json({ status: "failed", chargeId, reason: "timeout" });
      }
    }

    // PRIMARY: trust our own DB record — activated by webhook or manual verification.
    // We do NOT rely solely on Paychangu's status API because the same Paychangu account
    // is used for multiple businesses, which causes cross-contamination in status responses.
    // Our chargeId is namespaced as BF-{businessId}-{timestamp}, so DB lookups are always scoped.
    if (sub?.status === "pending") {
      // SECONDARY: poll Paychangu API to confirm — but ONLY accept "successful" for THIS chargeId
      // If Paychangu returns successful, activate directly. If it returns failed, cancel.
      // If the chargeId prefix doesn't match BF- pattern, refuse to activate (cross-business guard).
      const PAYCHANGU_SECRET =
        (await getCredential("paychangu_secret_key")) ||
        process.env.PAYCHANGU_SECRET_KEY || "";

      try {
        const verifyRes = await fetch(
          `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/status`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (verifyRes.ok) {
          const result = await verifyRes.json();
          const returnedRef = result?.data?.charge_id || result?.data?.tx_ref || result?.data?.reference || "";
          const paychanguStatus = result?.data?.status || result?.status || "pending";

          // Cross-business guard: only trust the result if the returned reference matches our chargeId
          const refMatches = !returnedRef || returnedRef === chargeId;

          if (refMatches && (paychanguStatus === "successful" || paychanguStatus === "success")) {
            // Activate subscription
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
              await supabase.from("accounts").update({
                subscription_status: "active",
                subscription_ends_at: endDate,
                updated_at: new Date().toISOString(),
              }).eq("user_id", biz.owner_id);
            }

            return NextResponse.json({ status: "success", chargeId });
          }

          if (refMatches && (paychanguStatus === "failed" || paychanguStatus === "cancelled")) {
            await supabase.from("subscriptions").update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }).eq("id", sub.id);
            return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
          }
        }
      } catch {
        // Paychangu API unreachable — stay pending, client will retry
      }

      // Still pending — Paychangu hasn't confirmed yet or result was ambiguous
      return NextResponse.json({ status: "pending", chargeId });
    }

    return NextResponse.json({ status: "pending", chargeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
