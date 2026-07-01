// src/app/api/onboarding/route.ts
// The setup-checklist writes go through this same-origin route instead of
// the browser calling Supabase's domain directly. The phone only ever talks
// to brandfledger-three.vercel.app (which it already loads fine); the server
// does the Supabase call, same as every other page's data fetch.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const step = body?.step as string | undefined;
    const supabase = await createClient();

    if (step === "business") {
      const { name, email, currency, invoice_prefix } = body?.data ?? {};
      if (!name) return NextResponse.json({ error: "Business name is required" }, { status: 400 });

      // Guard against double-insert if the request is somehow sent twice
      const { data: existing } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
      if (existing) return NextResponse.json({ business: existing, alreadyExists: true });

      const { data, error } = await supabase
        .from("businesses")
        .insert({ name, email, currency, invoice_prefix })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ business: data });
    }

    if (step === "customer") {
      const { name, email, phone } = body?.data ?? {};
      if (!name) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });

      const { data: biz, error: bizErr } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
      if (bizErr || !biz) return NextResponse.json({ error: bizErr?.message ?? "Business not found" }, { status: 400 });

      const { error } = await supabase
        .from("customers")
        .insert({ name, email, phone, business_id: biz.id, total_invoiced: 0 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (step === "product") {
      const { name, price, category } = body?.data ?? {};
      if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });

      const { data: biz, error: bizErr } = await supabase.from("businesses").select("id").limit(1).maybeSingle();
      if (bizErr || !biz) return NextResponse.json({ error: bizErr?.message ?? "Business not found" }, { status: 400 });

      const { error } = await supabase
        .from("products")
        .insert({ name, price: parseFloat(price) || 0, category, business_id: biz.id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
