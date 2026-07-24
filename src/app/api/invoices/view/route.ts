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

    // Get business and customer info
    const [business, customer] = await Promise.all([
      query("SELECT name, email, phone, address, currency FROM businesses WHERE id = $1", [invoice.business_id]),
      invoice.customer_id
        ? query("SELECT name, email, phone, address FROM customers WHERE id = $1", [invoice.customer_id])
        : Promise.resolve([]),
    ]);

    // Get invoice items
    const items = await query("SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order", [id]);

    return NextResponse.json({
      invoice: {
        ...invoice,
        items: items.map((item: any) => ({
          name: item.description,
          description: "",
          quantity: item.quantity,
          unit_price: item.price,
          total: item.total,
        })),
      },
      business: business[0] || null,
      customer: customer[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
