import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!data?.value?.encoded) return null;
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  } catch { return null; }
}

async function activateSubscription(sub: any, txId?: string) {
  const endDate = sub.plan === "annual"
    ? new Date(Date.now() + 365 * 86400000).toISOString()
    : new Date(Date.now() + 30 * 86400000).toISOString();
  const now = new Date().toISOString();

  await supabase.from("subscriptions").update({
    status: "active",
    paychangu_tx_id: txId || sub.paychangu_tx_ref,
    end_date: endDate,
    updated_at: now,
  }).eq("id", sub.id);

  const { data: biz } = await supabase
    .from("businesses").select("owner_id").eq("id", sub.business_id).maybeSingle();
  if (biz?.owner_id) {
    await supabase.from("profiles").update({
      subscription_status: "active",
      subscription_ends_at: endDate,
      updated_at: now,
    }).eq("id", biz.owner_id);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txRef = searchParams.get("tx_ref") || searchParams.get("charge_id");
    if (!txRef) {
      return NextResponse.redirect(new URL("/subscription?status=error", req.url));
    }

    const PAYCHANGU_SECRET = await getCredential("paychangu_secret_key");
    if (!PAYCHANGU_SECRET) {
      return NextResponse.redirect(new URL("/subscription?status=error&reason=config", req.url));
    }

    // Look up subscription in our DB first
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("paychangu_tx_ref", txRef)
      .maybeSingle();

    if (sub?.status === "active") {
      return NextResponse.redirect(new URL("/subscription?status=success", req.url));
    }

    if (!sub) {
      return NextResponse.redirect(new URL("/subscription?status=error&reason=notfound", req.url));
    }

    // PRIMARY: Direct Charge verify endpoint
    let verified = false;
    let txId: string | undefined;

    try {
      const verifyRes = await fetch(
        `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(txRef)}/verify`,
        {
          headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (verifyRes.ok) {
        const result = await verifyRes.json();
        const status = result?.data?.status || result?.status || "pending";
        const returnedRef = result?.data?.charge_id || result?.data?.tx_ref || "";
        const refMatches = !returnedRef || returnedRef === txRef;

        if (refMatches && (status === "successful" || status === "success")) {
          verified = true;
          txId = result?.data?.tx_id || result?.data?.charge_id;
        }
      }
    } catch {}

    // FALLBACK: Generic verify-payment endpoint
    if (!verified) {
      try {
        const fallbackRes = await fetch(
          `https://api.paychangu.com/verify-payment/${encodeURIComponent(txRef)}`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (fallbackRes.ok) {
          const fbResult = await fallbackRes.json();
          const fbStatus = fbResult?.data?.status || fbResult?.status || "pending";
          if (fbStatus === "successful" || fbStatus === "success") {
            verified = true;
            txId = fbResult?.data?.tx_id || fbResult?.data?.tx_ref;
          }
        }
      } catch {}
    }

    if (verified) {
      await activateSubscription(sub, txId);
      return NextResponse.redirect(new URL("/subscription?status=success", req.url));
    }

    return NextResponse.redirect(new URL("/subscription?status=failed", req.url));
  } catch {
    return NextResponse.redirect(new URL("/subscription?status=error", req.url));
  }
}
