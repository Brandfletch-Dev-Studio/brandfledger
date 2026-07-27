import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — list all businesses for the current user
export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, currency, invoice_prefix, address, phone, email, website, business_type, tax_id, logo_url, subscription_status, trial_ends_at, subscription_ends_at, created_at')
      .eq('owner_id', user.userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ businesses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a new business
export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, currency = "MWK", invoice_prefix = "INV" } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Business name is required" }, { status: 400 });

    // Count existing businesses (optional limit)
    const { count, error: countError } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.userId);

    if (countError) throw countError;
    if (count !== null && count >= 10) return NextResponse.json({ error: "Maximum 10 businesses per account" }, { status: 400 });

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: business, error: insertError } = await supabase
      .from('businesses')
      .insert({
        owner_id: user.userId,
        name: name.trim(),
        currency,
        invoice_prefix: invoice_prefix.toUpperCase(),
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt
      })
      .select('id, name, currency, invoice_prefix, subscription_status, trial_ends_at, created_at')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ business });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
