import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      name, email, phone, address, website, currency, invoice_prefix,
      business_type, tax_id,
      paychangu_secret_key, paychangu_public_key, payment_methods,
      custom_instructions,
    } = body;

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

    const updateData: Record<string, any> = {
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      website: website || null,
      currency: currency || "USD",
      invoice_prefix: invoice_prefix || "INV",
      business_type: business_type || "other",
      tax_id: tax_id || null,
      updated_at: new Date().toISOString(),
    };

    // Only update Paychangu/payment fields if explicitly provided
    if (paychangu_secret_key !== undefined) {
      updateData.paychangu_secret_key = paychangu_secret_key || null;
    }
    if (paychangu_public_key !== undefined) {
      updateData.paychangu_public_key = paychangu_public_key || null;
    }
    if (payment_methods !== undefined) {
      if (Array.isArray(payment_methods) && payment_methods.length <= 10) {
        updateData.payment_methods = payment_methods;
      }
    }

    const { data: result, error: updateError } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    // Save custom instructions to platform_settings (separate from businesses table)
  if (custom_instructions !== undefined) {
    const ciKey = "custom_instructions_" + businessId;
    const { data: existingCI } = await supabase
      .from("platform_settings")
      .select("key")
      .eq("key", ciKey)
      .maybeSingle();
    
    if (existingCI) {
      await supabase
        .from("platform_settings")
        .update({ value: { text: custom_instructions || "" } })
        .eq("key", ciKey);
    } else {
      await supabase
        .from("platform_settings")
        .insert({ key: ciKey, value: { text: custom_instructions || "" } });
    }
  }

  return NextResponse.json({ business: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const { data: ciData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "custom_instructions_" + businessId)
      .maybeSingle();

    return NextResponse.json({ 
      custom_instructions: ciData?.value ? (ciData.value as any).text || "" : "" 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
