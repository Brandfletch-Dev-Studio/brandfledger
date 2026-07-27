import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getBusinessId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const { data } = await supabase.from('businesses').select('id').eq('id', requestedId).eq('owner_id', userId).maybeSingle();
    if (!data) return null;
    return requestedId;
  }
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    const cookieId = cookieStore.get("activeBusinessId")?.value;
    if (cookieId) {
      const { data } = await supabase.from('businesses').select('id').eq('id', cookieId).eq('owner_id', userId).maybeSingle();
      if (data) return cookieId;
    }
  } catch {}
  const { data } = await supabase.from('businesses').select('id').eq('owner_id', userId).order('created_at').limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const [transactions, customers, products, categories, invoices] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    ]);

    return NextResponse.json({
      counts: {
        transactions: transactions.count || 0,
        customers: customers.count || 0,
        products: products.count || 0,
        categories: categories.count || 0,
        invoices: invoices.count || 0,
      },
      businessId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all";
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const deleted: Record<string, number> = {};

    if (scope === "all" || scope === "transactions") {
      const r = await supabase.from('transactions').delete().eq('business_id', businessId);
      deleted.transactions = r.count || 0;
    }
    if (scope === "all" || scope === "invoices") {
      const r = await supabase.from('invoices').delete().eq('business_id', businessId);
      deleted.invoices = r.count || 0;
    }
    if (scope === "all" || scope === "customers") {
      const r = await supabase.from('customers').delete().eq('business_id', businessId);
      deleted.customers = r.count || 0;
    }
    if (scope === "all" || scope === "products") {
      const r = await supabase.from('products').delete().eq('business_id', businessId);
      deleted.products = r.count || 0;
    }
    if (scope === "all" || scope === "categories") {
      const r = await supabase.from('categories').delete().eq('business_id', businessId);
      deleted.categories = r.count || 0;
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
