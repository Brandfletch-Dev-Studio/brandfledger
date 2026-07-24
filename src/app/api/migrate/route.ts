import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const results: string[] = [];

  // 1. Create platform_settings table
  const { error: e1 } = await supabase.from("platform_settings").select("id").limit(1);
  if (e1 && e1.message.includes("Could not find the table")) {
    results.push("platform_settings table needs to be created via SQL editor");
  } else {
    results.push("platform_settings table exists");
  }

  // 2. Check if owner_id column exists on businesses
  const { data: bizCheck, error: e2 } = await supabase
    .from("businesses")
    .select("id, name, owner_id")
    .limit(1);
  if (e2 && e2.message.includes("column")) {
    results.push("owner_id column missing on businesses — needs SQL migration");
  } else {
    results.push("owner_id column exists on businesses");
  }

  // 3. Insert default pricing if not exists
  const { data: existing } = await supabase
    .from("platform_settings")
    .select("key")
    .eq("key", "pricing")
    .maybeSingle();
  
  if (!existing) {
    const { error: e3 } = await supabase.from("platform_settings").upsert({
      key: "pricing",
      value: {
        monthly_rate: 15000,
        currency: "MWK",
        annual_rate: 150000,
        trial_days: 14,
        features: ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"],
      },
    });
    if (e3) results.push(`Failed to insert pricing: ${e3.message}`);
    else results.push("Default pricing inserted");
  } else {
    results.push("Pricing already configured");
  }

  return NextResponse.json({ results, message: "Run the SQL migration 20260724000004_auth_rls.sql in Supabase SQL editor to enable RLS and owner_id" });
}
