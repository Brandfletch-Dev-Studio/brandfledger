// Brandfledger WhatsApp Finance Manager — Message Sender
// Sends WhatsApp messages via the Meta Cloud API
// Reads credentials from the businesses table (per-business WhatsApp config)

import { supabase } from "@/lib/db";

async function getCredentials(businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("whatsapp_access_token, whatsapp_phone_number_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.whatsapp_access_token || !data.whatsapp_phone_number_id) return null;

  return {
    accessToken: data.whatsapp_access_token,
    phoneNumberId: data.whatsapp_phone_number_id,
  };
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  businessId: string
): Promise<boolean> {
  try {
    const creds = await getCredentials(businessId);
    if (!creds) {
      console.error("WhatsApp credentials not configured for business:", businessId);
      return false;
    }

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[\s+]/g, ""),
          type: "text",
          text: { body: text, preview_url: false },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("WhatsApp send failed:", err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return false;
  }
}
