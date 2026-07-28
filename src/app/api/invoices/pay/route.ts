import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function detectOperator(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
  if (/^(88|89)/.test(digits)) return "tnm";
  return "airtel";
}

function normalisePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("265")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/**
 * POST /api/invoices/pay
 * Public endpoint — initiates a Paychangu mobile money payment for an invoice.
 * No auth required (customers pay from the public invoice view link).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoice_id, phone, operator, payer_name } = body as {
      invoice_id: string;
      phone: string;
      operator?: string;
      payer_name?: string;
    };

    if (!invoice_id) return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    if (!phone) return NextResponse.json({ error: "Phone number required" }, { status: 400 });

    // Validate UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    // Fetch the invoice (public — no auth check, anyone with the link can pay)
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, business_id, invoice_number, total, amount_paid, balance_due, status, customer_id")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Don't allow payment on already-paid invoices
    const balanceDue = Number(invoice.balance_due || (invoice.total - (invoice.amount_paid || 0)));
    if (balanceDue <= 0) {
      return NextResponse.json({ error: "This invoice is already fully paid" }, { status: 400 });
    }

    // Normalise phone
    const normalised = normalisePhone(phone);
    if (normalised.length !== 9) {
      return NextResponse.json({
        error: `Invalid phone number. Enter your 9-digit number (e.g. 991234567). Got ${normalised.length} digits.`
      }, { status: 400 });
    }

    const operatorKey = operator || detectOperator(phone);
    const operatorRefId = OPERATORS[operatorKey];
    if (!operatorRefId) {
      return NextResponse.json({ error: "Unsupported operator. Use airtel or tnm." }, { status: 400 });
    }

    // Get business for Paychangu payload
    const { data: business } = await supabase
      .from("businesses")
      .select("name, email")
      .eq("id", invoice.business_id)
      .maybeSingle();

    // Get Paychangu secret key
    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY || "";

    if (!PAYCHANGU_SECRET) {
      return NextResponse.json({ error: "Payment not configured. Contact the business owner." }, { status: 503 });
    }

    // Create namespaced charge ID
    const chargeId = `INV-${invoice.id.slice(0, 8)}-${Date.now()}`;

    // Record pending payment attempt
    await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      business_id: invoice.business_id,
      payment_method: "paychangu",
      amount: balanceDue,
      status: "pending",
      paychangu_charge_id: chargeId,
      payer_name: payer_name || null,
      payer_phone: normalised,
    });

    // Initiate Paychangu direct charge
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
        amount: String(balanceDue),
        charge_id: chargeId,
        email: business?.email || "",
        first_name: business?.name || "",
        last_name: "",
      }),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      // Update the payment record as failed
      await supabase.from("invoice_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("paychangu_charge_id", chargeId);

      return NextResponse.json({
        error: result.message || result.error || "Payment initiation failed. Please try again."
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      chargeId,
      amount: balanceDue,
      invoice_number: invoice.invoice_number,
      message: result.message || "Check your phone and approve the payment prompt.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
