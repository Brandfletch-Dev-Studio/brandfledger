import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — returns the client's linked WhatsApp number + the platform's WhatsApp number
export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get the active business
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }
    const businessId = businesses[0].id;

    // Get the client's linked WhatsApp number
    const { data: member } = await supabase
      .from("business_members")
      .select("whatsapp_number")
      .eq("business_id", businessId)
      .eq("user_id", user.userId)
      .maybeSingle();

    // Get the platform's WhatsApp number (set by admin)
    const { data: platformNumberRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle();

    let platformNumber = "";
    if (platformNumberRow?.value) {
      platformNumber = typeof platformNumberRow.value === "object" && "value" in platformNumberRow.value
        ? platformNumberRow.value.value
        : String(platformNumberRow.value);
    }

    return NextResponse.json({
      linked_number: member?.whatsapp_number ?? "",
      platform_number: platformNumber,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — save the client's WhatsApp number to business_members
export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { whatsapp_number } = await request.json();
    if (!whatsapp_number || !/^\d{8,15}$/.test(whatsapp_number)) {
      return NextResponse.json({ error: "Please enter a valid phone number (digits only, with country code)" }, { status: 400 });
    }

    // Get the active business
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }
    const businessId = businesses[0].id;

    // Upsert business_members record
    const { data: existing } = await supabase
      .from("business_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("business_members")
        .update({ whatsapp_number })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("business_members")
        .insert({ business_id: businessId, user_id: user.userId, role: "owner", whatsapp_number });
    }

    return NextResponse.json({ success: true, linked_number: whatsapp_number });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
