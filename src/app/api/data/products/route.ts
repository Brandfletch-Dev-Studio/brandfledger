import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUUID(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const trimmed = v.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

async function getBusinessId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const { data } = await supabase.from('businesses').select('id').eq('id', requestedId).eq('owner_id', userId).maybeSingle();
    if (!data) return null;
    return requestedId;
  }
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const cookieId = cookieStore.get('activeBusinessId')?.value;
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

    const [productsRes, businessRes] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).order('name'),
      supabase.from('businesses').select('*').eq('id', businessId).maybeSingle()
    ]);

    if (productsRes.error) throw productsRes.error;
    if (businessRes.error) throw businessRes.error;

    return NextResponse.json({ products: productsRes.data, business: businessRes.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const businessId = await getBusinessId(user.userId, body.business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { name, description, price, cost, unit, stock_quantity, reorder_level } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(cost) || 0;
    const profitMargin = parsedPrice > 0 ? ((parsedPrice - parsedCost) / parsedPrice * 100) : 0;

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name: name.trim(),
        description: description || null,
        price: parsedPrice,
        cost: parsedCost,
        category_id: null,
        unit: unit || null,
        is_active: true,
        profit_margin: profitMargin,
        stock_quantity: parseFloat(stock_quantity) || 0,
        reorder_level: parseFloat(reorder_level) || 0,
        stock_unit: unit || 'units'
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, name, description, price, cost, unit, is_active, stock_quantity, reorder_level } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership via business (two-step)
    const { data: productCheck, error: checkError } = await supabase
      .from('products')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!productCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: businessCheck, error: bError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', productCheck.business_id)
      .eq('owner_id', user.userId)
      .maybeSingle();

    if (bError) throw bError;
    if (!businessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(cost) || 0;
    const profitMargin = parsedPrice > 0 ? ((parsedPrice - parsedCost) / parsedPrice * 100) : 0;

    const { data: product, error: updateError } = await supabase
      .from('products')
      .update({
        name: name?.trim() ?? null,
        description: description || null,
        price: parsedPrice,
        cost: parsedCost,
        category_id: null,
        unit: unit || null,
        is_active: is_active ?? true,
        profit_margin: profitMargin,
        stock_quantity: stock_quantity !== undefined ? parseFloat(stock_quantity) : undefined,
        reorder_level: reorder_level !== undefined ? parseFloat(reorder_level) : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Stock adjustment endpoint
export async function PATCH(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { product_id, action, quantity, unit_cost, note } = body;
    if (!product_id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    // Verify ownership
    const { data: productCheck } = await supabase
      .from('products')
      .select('business_id')
      .eq('id', product_id)
      .maybeSingle();
    if (!productCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: businessCheck } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', productCheck.business_id)
      .eq('owner_id', user.userId)
      .maybeSingle();
    if (!businessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === 'restock') {
      const { error } = await supabase.rpc('increment_product_stock', {
        p_product_id: product_id,
        p_quantity: parseFloat(quantity) || 0,
        p_unit_cost: parseFloat(unit_cost) || 0,
        p_note: note || null
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === 'adjust') {
      const { error } = await supabase.rpc('adjust_product_stock', {
        p_product_id: product_id,
        p_new_quantity: parseFloat(quantity) || 0,
        p_note: note || null
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (action === 'loss') {
      const { error } = await supabase.rpc('adjust_product_stock', {
        p_product_id: product_id,
        p_new_quantity: parseFloat(quantity) || 0,
        p_note: note || null,
        p_movement_type: 'loss'
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown action. Use: restock, adjust, loss" }, { status: 400 });
    }

    // Return updated product
    const { data: updated } = await supabase.from('products').select('*').eq('id', product_id).maybeSingle();
    return NextResponse.json({ product: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Stock movement history endpoint
export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership via business (two-step)
    const { data: productCheck, error: checkError } = await supabase
      .from('products')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!productCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: businessCheck, error: bError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', productCheck.business_id)
      .eq('owner_id', user.userId)
      .maybeSingle();

    if (bError) throw bError;
    if (!businessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
