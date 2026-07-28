import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyOwnership(businessId: string, userId: string) {
  const { data } = await supabase.from('businesses').select('id').eq('id', businessId).eq('owner_id', userId).maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let businessId: string | null = searchParams.get("business_id");
    
    if (!businessId) {
      // Read from cookie first (matches business switcher behavior)
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = cookies();
        const cookieId = cookieStore.get('activeBusinessId')?.value;
        if (cookieId) {
          const { data } = await supabase.from('businesses').select('id').eq('id', cookieId).eq('owner_id', user.userId).maybeSingle();
          if (data) businessId = cookieId;
        }
      } catch {}
    }
    
    if (!businessId) {
      const { data: businesses, error: bizError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.userId)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (bizError) throw bizError;
      if (!businesses) return NextResponse.json({ error: "No business found" }, { status: 404 });
      businessId = businesses.id;
    }

    if (!businessId || !await verifyOwnership(businessId, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [txResult, catResult, prodResult, bizResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('business_id', businessId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('business_id', businessId)
        .order('sort_order')
        .order('name'),
      supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle()
    ]);

    if (txResult.error) throw txResult.error;
    if (catResult.error) throw catResult.error;
    if (prodResult.error) throw prodResult.error;
    if (bizResult.error) throw bizResult.error;

    return NextResponse.json({
      business: bizResult.data,
      transactions: txResult.data || [],
      categories: catResult.data || [],
      products: prodResult.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, business_id, ...data } = body;

    if (!business_id) return NextResponse.json({ error: "business_id required" }, { status: 400 });
    if (!await verifyOwnership(business_id, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (action === "create_transaction") {
      const { type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          business_id,
          type,
          client_name: client_name || null,
          vendor_name: vendor_name || null,
          description,
          amount,
          cost_qty: cost_qty || 0,
          cost_amount: cost_amount || 0,
          category_id: category_id || null,
          category_name: category_name || null,
          product_id: product_id || null,
          payment_method: payment_method || "cash",
          date
        })
        .select('*')
        .single();
      if (txErr) throw txErr;

      // Auto-create or update customer atomically via SQL function (no race condition)
      if (type === "income" && client_name) {
        await supabase.rpc('upsert_customer_and_increment', {
          p_business_id: business_id,
          p_name: client_name.trim(),
          p_amount: amount
        });
      }

      return NextResponse.json({ transaction: tx });
    }

    if (action === "update_transaction") {
      const { id, type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;
      
      // If amount or client_name changed on an income transaction, adjust total_invoiced
      if (id) {
        const { data: oldTx } = await supabase
          .from('transactions')
          .select('type, client_name, amount, invoice_id')
          .eq('id', id)
          .eq('business_id', business_id)
          .maybeSingle();
        
        if (oldTx && oldTx.type === "income" && oldTx.client_name && !oldTx.invoice_id) {
          // Don't adjust total_invoiced for invoice-linked transactions
          await supabase.rpc('decrement_customer_total', {
            p_business_id: business_id,
            p_name: oldTx.client_name,
            p_amount: Number(oldTx.amount) || 0
          });
        }
        
        const newType = type !== undefined ? type : oldTx?.type;
        const newName = client_name !== undefined && client_name !== null ? client_name : oldTx?.client_name;
        const newAmount = amount !== undefined && amount !== null ? amount : oldTx?.amount;
        
        if (newType === "income" && newName && !oldTx?.invoice_id) {
          // Don't adjust for invoice-linked transactions
          await supabase.rpc('upsert_customer_and_increment', {
            p_business_id: business_id,
            p_name: newName.trim(),
            p_amount: Number(newAmount) || 0
          });
        }
      }

      const updateObj: any = { updated_at: new Date().toISOString() };
      if (type !== undefined && type !== null) updateObj.type = type;
      if (client_name !== undefined && client_name !== null) updateObj.client_name = client_name;
      if (vendor_name !== undefined && vendor_name !== null) updateObj.vendor_name = vendor_name;
      if (description !== undefined && description !== null) updateObj.description = description;
      if (amount !== undefined && amount !== null) updateObj.amount = amount;
      if (cost_qty !== undefined && cost_qty !== null) updateObj.cost_qty = cost_qty;
      if (cost_amount !== undefined && cost_amount !== null) updateObj.cost_amount = cost_amount;
      if (category_id !== undefined && category_id !== null) updateObj.category_id = category_id;
      if (category_name !== undefined && category_name !== null) updateObj.category_name = category_name;
      if (product_id !== undefined && product_id !== null) updateObj.product_id = product_id;
      if (payment_method !== undefined && payment_method !== null) updateObj.payment_method = payment_method;
      if (date !== undefined && date !== null) updateObj.date = date;

      const { data: updatedTx, error: updateError } = await supabase
        .from('transactions')
        .update(updateObj)
        .eq('id', id)
        .eq('business_id', business_id)
        .select('*')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedTx) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: updatedTx });
    }

    if (action === "create_category") {
      const { name, type, color } = data;
      const { data: category, error: catError } = await supabase
        .from('categories')
        .insert({
          business_id,
          name,
          type,
          color: color || null
        })
        .select('*')
        .single();
      if (catError) throw catError;
      return NextResponse.json({ category });
    }

    if (action === "delete_transaction") {
      const { id } = data;
      
      // BUG FIX: Before deleting, fetch the transaction to decrement customer total_invoiced
      const { data: txToDelete } = await supabase
        .from('transactions')
        .select('type, client_name, amount, invoice_id')
        .eq('id', id)
        .eq('business_id', business_id)
        .maybeSingle();
      
      if (txToDelete && txToDelete.type === "income" && txToDelete.client_name && !txToDelete.invoice_id) {
        // Only decrement if this is NOT a linked invoice transaction
        // (invoice-linked transactions are P&L reflections; total_invoiced was set by the invoice)
        await supabase.rpc('decrement_customer_total', {
          p_business_id: business_id,
          p_name: txToDelete.client_name,
          p_amount: Number(txToDelete.amount) || 0
        });
      }
      
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('business_id', business_id);
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true });
    }

    if (action === "delete_category") {
      const { id } = data;
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('business_id', business_id);
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, business_id, ...data } = body;
    if (!id || !business_id) return NextResponse.json({ error: "id and business_id required" }, { status: 400 });
    if (!await verifyOwnership(business_id, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;

    // If amount or client_name changed on an income transaction, adjust total_invoiced
    const { data: oldTx } = await supabase
      .from('transactions')
      .select('type, client_name, amount, invoice_id')
      .eq('id', id)
      .eq('business_id', business_id)
      .maybeSingle();
    
    if (oldTx && oldTx.type === "income" && oldTx.client_name && !oldTx.invoice_id) {
      await supabase.rpc('decrement_customer_total', {
        p_business_id: business_id,
        p_name: oldTx.client_name,
        p_amount: Number(oldTx.amount) || 0
      });
    }
    
    const newType = type !== undefined ? type : oldTx?.type;
    const newName = client_name !== undefined && client_name !== null ? client_name : oldTx?.client_name;
    const newAmount = amount !== undefined && amount !== null ? amount : oldTx?.amount;
    
    if (newType === "income" && newName && !oldTx?.invoice_id) {
      await supabase.rpc('upsert_customer_and_increment', {
        p_business_id: business_id,
        p_name: newName.trim(),
        p_amount: Number(newAmount) || 0
      });
    }

    const updateObj: any = { updated_at: new Date().toISOString() };
    if (type !== undefined && type !== null) updateObj.type = type;
    if (client_name !== undefined && client_name !== null) updateObj.client_name = client_name;
    if (vendor_name !== undefined && vendor_name !== null) updateObj.vendor_name = vendor_name;
    if (description !== undefined && description !== null) updateObj.description = description;
    if (amount !== undefined && amount !== null) updateObj.amount = amount;
    if (cost_qty !== undefined && cost_qty !== null) updateObj.cost_qty = cost_qty;
    if (cost_amount !== undefined && cost_amount !== null) updateObj.cost_amount = cost_amount;
    if (category_id !== undefined && category_id !== null) updateObj.category_id = category_id;
    if (category_name !== undefined && category_name !== null) updateObj.category_name = category_name;
    if (product_id !== undefined && product_id !== null) updateObj.product_id = product_id;
    if (payment_method !== undefined && payment_method !== null) updateObj.payment_method = payment_method;
    if (date !== undefined && date !== null) updateObj.date = date;

    const { data: updatedTx, error: updateError } = await supabase
      .from('transactions')
      .update(updateObj)
      .eq('id', id)
      .eq('business_id', business_id)
      .select('*')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updatedTx) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ transaction: updatedTx });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
