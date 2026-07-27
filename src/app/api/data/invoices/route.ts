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

async function verifyOwnership(businessId: string, userId: string) {
  const { data } = await supabase.from('businesses').select('id').eq('id', businessId).eq('owner_id', userId).maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const [invoicesResult, customersResult, productsResult, businessResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, customers (name, email, phone)')
        .eq('business_id', businessId)
        .order('issue_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('business_id', businessId)
        .order('name'),
      supabase
        .from('products')
        .select('id, name, price, cost')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle(),
    ]);

    if (invoicesResult.error) throw invoicesResult.error;
    if (customersResult.error) throw customersResult.error;
    if (productsResult.error) throw productsResult.error;
    if (businessResult.error) throw businessResult.error;

    const invoices = (invoicesResult.data || []).map((inv: any) => {
      const { customers, ...rest } = inv;
      return {
        ...rest,
        customer_name: customers?.name ?? null,
        customer_email: customers?.email ?? null,
        customer_phone: customers?.phone ?? null,
      };
    });

    return NextResponse.json({
      business: businessResult.data,
      invoices,
      customers: customersResult.data || [],
      products: productsResult.data || [],
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
    const businessId = await getBusinessId(user.userId, body.business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { customer_id, customer_name, issue_date, due_date, status, notes, items, tax_rate } = body;

    // Generate invoice number
    const { data: biz, error: bizError } = await supabase
      .from('businesses')
      .select('invoice_prefix')
      .eq('id', businessId)
      .maybeSingle();
    if (bizError) throw bizError;
    const prefix = biz?.invoice_prefix || "INV";

    const { count, error: countError } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    if (countError) throw countError;
    const num = (count || 0) + 1;

    const year = new Date().getFullYear();
    const invNumber = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

    // Calculate totals and build items JSONB
    let subtotal = 0;
    const processedItems = (items || []).map((item: any, idx: number) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      return {
        product_id: item.product_id || null,
        name: item.description || item.name || "",
        description: item.description || "",
        quantity: qty,
        unit_price: price,
        total: lineTotal,
        sort_order: idx,
      };
    });

    const taxAmount = subtotal * (parseFloat(tax_rate) || 0) / 100;
    const total = subtotal + taxAmount;

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        customer_id: customer_id || null,
        invoice_number: invNumber,
        status: status || "draft",
        issue_date: issue_date || new Date().toISOString().split("T")[0],
        due_date: due_date || null,
        items: processedItems,
        subtotal,
        tax_rate: parseFloat(tax_rate) || 0,
        tax_amount: taxAmount,
        total,
        notes: notes || null
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    // Update customer total_invoiced
    if (customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('total_invoiced')
        .eq('id', customer_id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (customer) {
        const currentTotalInvoiced = Number(customer.total_invoiced) || 0;
        const newTotalInvoiced = currentTotalInvoiced + total;
        const { error: updateCustError } = await supabase
          .from('customers')
          .update({
            total_invoiced: newTotalInvoiced,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer_id);
        if (updateCustError) throw updateCustError;
      }
    }

    return NextResponse.json({ invoice });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, due_date } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = await verifyOwnership(inv.business_id, user.userId);
    if (!isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status) {
      const { error: updateStatusError } = await supabase
        .from('invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateStatusError) throw updateStatusError;

      if (status === "paid") {
        // Fetch the full invoice with its customer name
        const { data: invData, error: invDataError } = await supabase
          .from('invoices')
          .select('*, customers (name)')
          .eq('id', id)
          .maybeSingle();
        if (invDataError) throw invDataError;

        if (invData) {
          const invoice = {
            ...invData,
            customer_name: invData.customers?.name ?? null
          };
          // Check if a transaction already exists for this invoice to avoid duplicates
          const { data: existingTx, error: txError } = await supabase
            .from('transactions')
            .select('id')
            .eq('invoice_id', id)
            .limit(1)
            .maybeSingle();
          if (txError) throw txError;

          if (!existingTx) {
            // If no transaction exists, insert one
            const clientName = invoice.customer_name || ("Invoice " + invoice.invoice_number);
            const description = "Invoice " + invoice.invoice_number;
            const currentDate = new Date().toISOString().split("T")[0];

            const { error: insertTxError } = await supabase
              .from('transactions')
              .insert({
                business_id: invoice.business_id,
                type: 'income',
                client_name: clientName,
                description: description,
                amount: invoice.total,
                cost_amount: 0,
                payment_method: 'invoice',
                date: currentDate,
                invoice_id: invoice.id,
                created_at: new Date().toISOString()
              });
            if (insertTxError) throw insertTxError;
          }
        }
      }
    }

    if (notes !== undefined || due_date !== undefined) {
      const updateObj: any = { updated_at: new Date().toISOString() };
      if (notes !== undefined) updateObj.notes = notes || null;
      if (due_date !== undefined) updateObj.due_date = due_date || null;

      const { error: updateInvoiceError } = await supabase
        .from('invoices')
        .update(updateObj)
        .eq('id', id);
      if (updateInvoiceError) throw updateInvoiceError;
    }

    const { data: updated, error: updatedError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (updatedError) throw updatedError;

    return NextResponse.json({ invoice: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = await verifyOwnership(inv.business_id, user.userId);
    if (!isOwner) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}