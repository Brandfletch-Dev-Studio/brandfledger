import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public endpoint — no auth required (for shared invoice links)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const invoices = await query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (invoices.length === 0) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const invoice = invoices[0];

    // Get business info
    const business = await query("SELECT name, email, phone, address, currency FROM businesses WHERE id = $1", [invoice.business_id]);

    // Get customer info
    let customer = [];
    if (invoice.customer_id) {
      customer = await query("SELECT name, email, phone, address FROM customers WHERE id = $1", [invoice.customer_id]);
    }

    // items is a JSONB column
    const items = Array.isArray(invoice.items) ? invoice.items : [];

    return NextResponse.json({
      invoice: { ...invoice, items },
      business: business[0] || null,
      customer: customer[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
