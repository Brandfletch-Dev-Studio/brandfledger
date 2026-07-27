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

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const [customersRes, incomeTxRes, businessRes] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', businessId).order('name'),
      supabase.from('transactions').select('id, client_name, amount, cost_amount, profit, date, description, type, payment_method').eq('business_id', businessId).eq('type', 'income').order('date', { ascending: false }),
      supabase.from('businesses').select('*').eq('id', businessId).maybeSingle()
    ]);

    if (customersRes.error) throw customersRes.error;
    if (incomeTxRes.error) throw incomeTxRes.error;
    if (businessRes.error) throw businessRes.error;

    return NextResponse.json({
      business: businessRes.data,
      customers: customersRes.data,
      incomeTx: incomeTxRes.data
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
    const { name, email, phone, address, notes, business_id } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const businessId = await getBusinessId(user.userId, business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        total_invoiced: 0
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, name, email, phone, address, notes } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership via business (two-step)
    const { data: customerCheck, error: checkError } = await supabase
      .from('customers')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!customerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: businessCheck, error: bError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', customerCheck.business_id)
      .eq('owner_id', user.userId)
      .maybeSingle();

    if (bError) throw bError;
    if (!businessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: customer, error: updateError } = await supabase
      .from('customers')
      .update({
        name: name?.trim() ?? null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ customer });
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

    // Verify ownership via business (two-step)
    const { data: customerCheck, error: checkError } = await supabase
      .from('customers')
      .select('business_id')
      .eq('id', id)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!customerCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: businessCheck, error: bError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', customerCheck.business_id)
      .eq('owner_id', user.userId)
      .maybeSingle();

    if (bError) throw bError;
    if (!businessCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
