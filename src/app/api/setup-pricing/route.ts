import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Create platform_settings table
  const { error: createError } = await supabase.rpc("exec_sql", {
    sql: `CREATE TABLE IF NOT EXISTS platform_settings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT now()
    );`,
  });

  if (createError) {
    // Try direct insert approach — table might already exist
    const { data, error } = await supabase
      .from("platform_settings")
      .upsert({
        key: "pricing",
        value: {
          monthly_rate: 15000,
          currency: "MWK",
          annual_rate: 150000,
          trial_days: 14,
          features: [
            "Unlimited invoices",
            "Unlimited businesses",
            "Profit tracking",
            "Team members",
            "Reports & exports",
            "Priority support",
          ],
        },
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message, createError: createError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Pricing configured", data });
  }

  // Insert default pricing
  const { data, error } = await supabase
    .from("platform_settings")
    .upsert({
      key: "pricing",
      value: {
        monthly_rate: 15000,
        currency: "MWK",
        annual_rate: 150000,
        trial_days: 14,
        features: [
          "Unlimited invoices",
          "Unlimited businesses",
          "Profit tracking",
          "Team members",
          "Reports & exports",
          "Priority support",
        ],
      },
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Platform settings table created and pricing configured", data });
}
