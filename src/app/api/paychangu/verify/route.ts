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

    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY || "";

    // Verify with Paychangu Direct Charge verify endpoint
    const verifyRes = await fetch(
      `https://api.paychangu.com/mobile-money/payments/${chargeId}/status`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        },
      }
    );

    const result = await verifyRes.json();
    const paychanguStatus = result?.data?.status || result?.status || "pending";

    // Map Paychangu status to our status
    let status: "pending" | "success" | "failed" = "pending";
    if (paychanguStatus === "successful" || paychanguStatus === "success") {
      status = "success";
    } else if (paychanguStatus === "failed" || paychanguStatus === "cancelled") {
      status = "failed";
    }

    // If success, activate subscription
    if (status === "success") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("paychangu_tx_ref", chargeId)
        .maybeSingle();

      if (sub && sub.status !== "active") {
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
      }
    }

    return NextResponse.json({ status, chargeId, raw: result?.data ?? {} });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
