import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — read current WhatsApp settings for the user's active business
export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get the active business (cookie-first, fallback to oldest)
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, whatsapp_access_token, whatsapp_phone_number_id, whatsapp_verify_token")
      .eq("owner_id", user.userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (!businesses || businesses.length === 0) {
      return NextResponse.json({ error: "No business found" }, { status: 404 });
    }
    const biz = businesses[0];

    // Get linked WhatsApp number from business_members
    const { data: member } = await supabase
      .from("business_members")
      .select("whatsapp_number")
      .eq("business_id", biz.id)
      .eq("user_id", user.userId)
      .maybeSingle();

    // Get OpenAI key from platform_settings
    const { data: openaiRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "openai_api_key")
      .maybeSingle();
    let openaiKey = "";
    if (openaiRow?.value) {
      if (typeof openaiRow.value === "object" && "encoded" in openaiRow.value) {
        openaiKey = Buffer.from(openaiRow.value.encoded, "base64").toString("utf-8");
      } else if (typeof openaiRow.value === "string") {
        openaiKey = openaiRow.value;
      }
    }

    return NextResponse.json({
      whatsapp_number: member?.whatsapp_number ?? "",
      whatsapp_access_token: biz.whatsapp_access_token ?? "",
      whatsapp_phone_number_id: biz.whatsapp_phone_number_id ?? "",
      whatsapp_verify_token: biz.whatsapp_verify_token ?? "",
      openai_api_key: openaiKey,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — save WhatsApp settings
export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { whatsapp_number, whatsapp_access_token, whatsapp_phone_number_id, whatsapp_verify_token, openai_api_key } = body;

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

    // Save WhatsApp credentials to the businesses table
    const { error: bizError } = await supabase
      .from("businesses")
      .update({
        whatsapp_access_token: whatsapp_access_token || null,
        whatsapp_phone_number_id: whatsapp_phone_number_id || null,
        whatsapp_verify_token: whatsapp_verify_token || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);
    if (bizError) throw bizError;

    // Save WhatsApp number to business_members
    if (whatsapp_number) {
      const { data: existingMember } = await supabase
        .from("business_members")
        .select("id")
        .eq("business_id", businessId)
        .eq("user_id", user.userId)
        .maybeSingle();

      if (existingMember) {
        await supabase
          .from("business_members")
          .update({ whatsapp_number })
          .eq("id", existingMember.id);
      } else {
        await supabase
          .from("business_members")
          .insert({ business_id: businessId, user_id: user.userId, role: "owner", whatsapp_number });
      }
    }

    // Save OpenAI key to platform_settings
    if (openai_api_key) {
      const { data: existingKey } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "openai_api_key")
        .maybeSingle();

      if (existingKey) {
        await supabase
          .from("platform_settings")
          .update({ value: { encoded: Buffer.from(openai_api_key).toString("base64") }, updated_at: new Date().toISOString() })
          .eq("id", existingKey.id);
      } else {
        await supabase
          .from("platform_settings")
          .insert({ key: "openai_api_key", value: { encoded: Buffer.from(openai_api_key).toString("base64") } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
