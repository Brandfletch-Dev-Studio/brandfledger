// Brandfledger WhatsApp Finance Manager — Message Sender
// Sends WhatsApp messages via the Meta Cloud API

async function getCredentials() {
  const { supabase } = await import("@/lib/db");
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["whatsapp_access_token", "whatsapp_phone_number_id", "whatsapp_verify_token"]);
  if (!data) return null;
  const settings: Record<string, any> = {};
  for (const row of data) {
    const val = row.value;
    if (val && typeof val === "object" && "encoded" in val) {
      settings[row.key] = Buffer.from(val.encoded, "base64").toString("utf-8");
    } else if (typeof val === "string") {
      settings[row.key] = val;
    } else if (val && typeof val === "object" && "value" in val) {
      settings[row.key] = val.value;
    } else {
      settings[row.key] = val;
    }
  }
  return settings;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  try {
    const creds = await getCredentials();
    if (!creds?.whatsapp_access_token || !creds?.whatsapp_phone_number_id) {
      console.error("WhatsApp credentials not configured");
      return false;
    }

    const phoneNumberId = creds.whatsapp_phone_number_id;
    const accessToken = creds.whatsapp_access_token;

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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

export async function getCredentialsSync() {
  return getCredentials();
}
