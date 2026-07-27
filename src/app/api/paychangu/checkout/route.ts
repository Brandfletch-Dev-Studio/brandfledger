import { NextRequest, NextResponse } from "next/server";
import { getDbUser, supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Paychangu MoMo operator ref IDs (Malawi)
const OPERATORS: Record<string, string> = {
  airtel: "20be6c20-adeb-4b5b-a7ba-0769820df4fb",
  tnm:    "27494cb5-ba9e-437f-a114-4e7a7686bcca",
};

async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!data?.value?.encoded) return null;
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  } catch { return null; }
}

/** Detect operator from phone number prefix */
function detectOperator(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
  // TNM starts with 88/89, Airtel starts with 99/98/97/96/95
  if (/^(88|89)/.test(digits)) return "tnm";
  return "airtel"; // default
}

/** Normalise phone to 265XXXXXXXXX */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("265")) return digits;
  if (digits.startsWith("0")) return "265" + digits.slice(1);
  return "265" + digits;
}

export async function GET() {
  // Return supported operators list
  return NextResponse.json({
    operators: [
      { id: "airtel", name: "Airtel Money",  ref_id: OPERATORS.airtel },
      { id: "tnm",    name: "TNM Mpamba",    ref_id: OPERATORS.tnm   },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { plan, phone, operator } = body as {
      plan: "monthly" | "annual";
      phone: string;
      operator?: string;
    };

    if (!phone) return NextResponse.json({ error: "Phone number is required for mobile money payment." }, { status: 400 });

    const normalised = normalisePhone(phone);
    if (normalised.length < 12) return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });

    const operatorKey = operator || detectOperator(phone);
    const operatorRefId = OPERATORS[operatorKey];
    if (!operatorRefId) return NextResponse.json({ error: "Unsupported operator." }, { status: 400 });

    // Pricing
    const { data: pricingRow } = await supabase.from("platform_settings").select("value").eq("key", "pricing").maybeSingle();
    const pricing = pricingRow?.value ?? { monthly_rate: 15000, annual_rate: 150000, currency: "MWK" };
    const amount = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;

    // Business
    const { data: business } = await supabase
      .from("businesses").select("id, name, email")
      .eq("owner_id", user.userId).order("created_at").limit(1).maybeSingle();
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const chargeId = `BF-${business.id.slice(0, 8)}-${Date.now()}`;

    // Store pending subscription
    await supabase.from("subscriptions").insert({
      business_id: business.id,
      plan,
      amount,
      currency: pricing.currency || "MWK",
      status: "pending",
      paychangu_tx_ref: chargeId,
      start_date: new Date().toISOString(),
    });

    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY || "";

    if (!PAYCHANGU_SECRET) {
      return NextResponse.json({ error: "Payment not configured. Contact support." }, { status: 503 });
    }

    // Direct Charge API call
    const response = await fetch("https://api.paychangu.com/mobile-money/payments/initialize", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
      },
      body: JSON.stringify({
        mobile: normalised,
        mobile_money_operator_ref_id: operatorRefId,
        amount: String(amount),
        charge_id: chargeId,
        email: business.email || user.email || "",
        first_name: business.name || "",
        last_name: "",
      }),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      return NextResponse.json(
        { error: result.message || result.error || "Payment initiation failed. Please try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      chargeId,
      message: result.message || "Check your phone and approve the payment prompt.",
      data: result.data ?? {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
