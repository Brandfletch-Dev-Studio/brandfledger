import { NextRequest, NextResponse } from "next/server";
import { getDbUser, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getDbUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { plan } = body as { plan: "monthly" | "annual" };

    // Get pricing from platform_settings
    const pricingRows = await query("SELECT value FROM platform_settings WHERE key = 'pricing'");
    const pricing = pricingRows[0]?.value ?? { monthly_rate: 15000, annual_rate: 150000, currency: "MWK" };

    const amount = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
    const currency = pricing.currency || "MWK";

    // Get business
    const businesses = await query("SELECT id, name, email FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
    const business = businesses[0];
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    // Generate unique tx_ref
    const txRef = `BF-${business.id.slice(0, 8)}-${Date.now()}`;

    // Store pending subscription
    await query(
      `INSERT INTO subscriptions (business_id, plan, amount, currency, status, paychangu_tx_ref, start_date)
       VALUES ($1, $2, $3, $4, 'pending', $5, now())`,
      [business.id, plan, amount, currency, txRef]
    );

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

    const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY || "sec_test_NmI2ZDk4NjFlMzI0NDBlNjBiZWM3YzA2YjExZDM5NjY5MjY4NDQ3Yz";

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

    return NextResponse.json({
      checkoutUrl: result.data?.checkout_url,
      txRef,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
