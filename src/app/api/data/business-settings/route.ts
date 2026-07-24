import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, email, phone, address, website, currency, invoice_prefix, business_type, tax_id } = body;

    // Get the user's first business
    const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
    if (businesses.length === 0) return NextResponse.json({ error: "No business found" }, { status: 404 });
    const businessId = businesses[0].id;

    const result = await query(
      `UPDATE businesses SET
        name = $1, email = $2, phone = $3, address = $4, website = $5,
        currency = $6, invoice_prefix = $7, business_type = $8, tax_id = $9,
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [name, email || null, phone || null, address || null, website || null,
       currency || "USD", invoice_prefix || "INV", business_type || "other", tax_id || null, businessId]
    );

    return NextResponse.json({ business: result[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
