import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, email, phone, address, website, currency, invoice_prefix, business_type, tax_id } = body;

    // Get the user's first business
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.userId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (bizError) throw bizError;
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }
    const businessId = businesses[0].id;

    const { data: result, error: updateError } = await supabase
      .from('businesses')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        currency: currency || "USD",
        invoice_prefix: invoice_prefix || "INV",
        business_type: business_type || "other",
        tax_id: tax_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ business: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
