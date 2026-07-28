// Brandfledger WhatsApp Finance Manager — Message Sender
// Sends WhatsApp messages via the Meta Cloud API
// Reads credentials from platform_settings (platform-level config)

import { supabase } from "@/lib/db";

async function getCredentials() {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["whatsapp_access_token", "whatsapp_phone_number_id"]);

  if (error || !data) return null;

  const map: Record<string, any> = {};
  for (const row of data) map[row.key] = row.value;

  let accessToken = "";
  let phoneNumberId = "";

  if (map.whatsapp_access_token?.encoded) {
    accessToken = Buffer.from(map.whatsapp_access_token.encoded, "base64").toString("utf-8");
  }
  if (map.whatsapp_phone_number_id?.value) {
    phoneNumberId = map.whatsapp_phone_number_id.value;
  } else if (map.whatsapp_phone_number_id?.encoded) {
    phoneNumberId = Buffer.from(map.whatsapp_phone_number_id.encoded, "base64").toString("utf-8");
  }

  if (!accessToken || !phoneNumberId) return null;

  return { accessToken, phoneNumberId };
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  businessId?: string
): Promise<boolean> {
  try {
    const creds = await getCredentials();
    if (!creds) {
      console.error("WhatsApp credentials not configured");
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
