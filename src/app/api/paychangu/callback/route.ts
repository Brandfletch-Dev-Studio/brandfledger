import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txRef = searchParams.get("tx_ref");
    if (!txRef) {
      return NextResponse.redirect(new URL("/subscription?status=error", req.url));
    }

    const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY ||
      "sec_test_NmI2ZDk4NjFlMzI0NDBlNjBiZWM3YzA2YjExZDM5NjY5MjY4NDQ3Yz";

    const verifyRes = await fetch(
      `https://api.paychangu.com/verify-payment/${txRef}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        },
      }
    );
    const verifyResult = await verifyRes.json();

    if (
      verifyRes.ok &&
      verifyResult.status === "success" &&
      verifyResult.data?.status === "success"
    ) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("paychangu_tx_ref", txRef)
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
            paychangu_tx_id: verifyResult.data?.tx_id || txRef,
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

        return NextResponse.redirect(
          new URL("/subscription?status=success", req.url)
        );
      }
    }

    return NextResponse.redirect(
      new URL("/subscription?status=failed", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/subscription?status=error", req.url)
    );
  }
}
