import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public endpoint — no auth required (for shared invoice links)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (invoiceErr) throw invoiceErr;
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Get business info
    const { data: business, error: businessErr } = await supabase
      .from("businesses")
      .select("name, email, phone, address, currency")
      .eq("id", invoice.business_id)
      .maybeSingle();

    if (businessErr) throw businessErr;

    // Get customer info
    let customer = null;
    if (invoice.customer_id) {
      const { data: customerData, error: customerErr } = await supabase
        .from("customers")
        .select("name, email, phone, address")
        .eq("id", invoice.customer_id)
        .maybeSingle();

      if (customerErr) throw customerErr;
      customer = customerData;
    }

    // items is a JSONB column
    const items = Array.isArray(invoice.items) ? invoice.items : [];

    return NextResponse.json({
      invoice: { ...invoice, items },
      business: business || null,
      customer: customer || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
