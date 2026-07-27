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

    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY || "";

    // Verify with Paychangu
    const verifyRes = await fetch(
      `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/status`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` } }
    );

    const result = await verifyRes.json();
    const paychanguStatus = result?.data?.status || result?.status || "pending";

    let status: "pending" | "success" | "failed" = "pending";
    if (paychanguStatus === "successful" || paychanguStatus === "success") status = "success";
    else if (paychanguStatus === "failed" || paychanguStatus === "cancelled") status = "failed";

    // Activate subscription on success
    if (status === "success" && sub && sub.status !== "active") {
      const endDate = sub.plan === "annual"
        ? new Date(Date.now() + 365 * 86400000).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      await supabase.from("subscriptions").update({
        status: "active",
        end_date: endDate,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);

      // Also update accounts table so paywall unlocks immediately
      const { data: biz } = await supabase
        .from("businesses").select("owner_id").eq("id", sub.business_id).maybeSingle();
      if (biz?.owner_id) {
        await supabase.from("accounts").update({
          subscription_status: "active",
          subscription_ends_at: endDate,
          updated_at: new Date().toISOString(),
        }).eq("user_id", biz.owner_id);
      }
    }

    // Mark as cancelled if Paychangu confirms failure
    if (status === "failed" && sub && sub.status === "pending") {
      await supabase.from("subscriptions").update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }

    return NextResponse.json({ status, chargeId, raw: result?.data ?? {} });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
