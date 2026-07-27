import { NextRequest, NextResponse } from "next/server";
import { getDbUser, supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!data?.value?.encoded) return null;
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { plan } = body as { plan: "monthly" | "annual" };

    // Get pricing
    const { data: pricingRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "pricing")
      .maybeSingle();
    const pricing = pricingRow?.value ?? { monthly_rate: 15000, annual_rate: 150000, currency: "MWK" };
    const amount = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
    const currency = pricing.currency || "MWK";

    // Get business
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, email")
      .eq("owner_id", user.userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const txRef = `BF-${business.id.slice(0, 8)}-${Date.now()}`;

    await supabase.from("subscriptions").insert({
      business_id: business.id,
      plan,
      amount,
      currency,
      status: "pending",
      paychangu_tx_ref: txRef,
      start_date: new Date().toISOString(),
    });

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://brandfledger-three.vercel.app";

    const paychanguPayload = {
      amount: String(amount),
      currency,
      tx_ref: txRef,
      callback_url: `${APP_URL}/api/paychangu/callback`,
      return_url: `${APP_URL}/subscription?status=failed`,
      first_name: business.name || "",
      last_name: "",
      email: business.email || user.email || "",
      customization: {
        title: "Brandfledger Subscription",
        description: `${plan === "annual" ? "Annual" : "Monthly"} subscription — ${currency} ${amount}`,
      },
    };

    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY ||
      "";

    if (!PAYCHANGU_SECRET) {
      return NextResponse.json(
        { error: "Payment not configured. Admin must add Paychangu credentials in Admin Settings." },
        { status: 503 }
      );
    }

    const response = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
      },
      body: JSON.stringify(paychanguPayload),
    });

    const result = await response.json();
    if (!response.ok || result.status !== "success") {
      return NextResponse.json(
        { error: result.message || "Failed to create payment session" },
        { status: 400 }
      );
    }

    return NextResponse.json({ checkoutUrl: result.data?.checkout_url, txRef });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
