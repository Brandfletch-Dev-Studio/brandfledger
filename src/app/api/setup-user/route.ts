import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    // Get the user ID for geniuspulse22@gmail.com from profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", "geniuspulse22@gmail.com")
      .limit(1)
      .maybeSingle();
    if (profileErr) throw profileErr;
    const userId = profile?.id;

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Link all existing businesses to this user (that don't have an owner_id)
    const { data: updatedBusinesses, error: updateErr } = await supabase
      .from("businesses")
      .update({ owner_id: userId })
      .is("owner_id", null)
      .select("id, name");

    if (updateErr) throw updateErr;
    const linkedBusinesses = updatedBusinesses ? updatedBusinesses.length : 0;

    // Insert default pricing if not exists
    const pricingVal = {
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
        "Priority support"
      ]
    };

    // Upsert pricing setting
    const { error: insertErr } = await supabase
      .from("platform_settings")
      .upsert({ key: "pricing", value: pricingVal }, { onConflict: "key" });

    if (insertErr) throw insertErr;

    // Fetch businesses and settings
    const { data: businesses, error: bizErr } = await supabase
      .from("businesses")
      .select("id, name, owner_id");
    if (bizErr) throw bizErr;

    const { data: settings, error: settingsErr } = await supabase
      .from("platform_settings")
      .select("key");
    if (settingsErr) throw settingsErr;

    return NextResponse.json({
      success: true,
      userId,
      linkedBusinesses,
      businesses: businesses || [],
      platformSettings: (settings || []).map((r: any) => r.key),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
