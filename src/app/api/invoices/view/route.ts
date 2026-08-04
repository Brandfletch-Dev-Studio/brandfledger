import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices").select("*").eq("id", id).maybeSingle();
    if (invoiceErr) throw invoiceErr;
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Include payment_methods and paychangu availability in business data
    const { data: business, error: businessErr } = await supabase
      .from("businesses")
      .select("name, email, phone, address, currency, payment_methods, paychangu_secret_key, logo_url, invoice_accent_color, invoice_template")
      .eq("id", invoice.business_id).maybeSingle();
    if (businessErr) throw businessErr;

    let customer = null;
    if (invoice.customer_id) {
      const { data: customerData, error: customerErr } = await supabase
        .from("customers").select("name, email, phone, address").eq("id", invoice.customer_id).maybeSingle();
      if (customerErr) throw customerErr;
      customer = customerData;
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];

    return NextResponse.json({
      invoice: { ...invoice, items },
      business: {
        name: business?.name, email: business?.email, phone: business?.phone,
        address: business?.address, currency: business?.currency,
        payment_methods: business?.payment_methods || [],
        paychangu_enabled: !!business?.paychangu_secret_key,
        logo_url: business?.logo_url || null,
        invoice_accent_color: business?.invoice_accent_color || "#4f46e5",
        invoice_template: business?.invoice_template || "classic",
      },
      customer: customer || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
