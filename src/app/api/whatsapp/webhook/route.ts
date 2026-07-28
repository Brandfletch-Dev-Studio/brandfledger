// Brandfledger WhatsApp Finance Manager — Webhook Handler
// Receives incoming WhatsApp messages from Meta's Cloud API
// GET: webhook verification
// POST: incoming messages

import { processWhatsAppMessage } from "@/lib/whatsapp/agent";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — Meta webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe") {
    // Get the verify token from platform_settings
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "whatsapp_verify_token")
      .maybeSingle();

    let verifyToken = "";
    if (data?.value?.encoded) {
      verifyToken = Buffer.from(data.value.encoded, "base64").toString("utf-8");
    } else if (typeof data?.value === "string") {
      verifyToken = data.value;
    } else if (data?.value?.value) {
      verifyToken = data.value.value;
    }

    if (token === verifyToken && verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  return new Response("Not Found", { status: 404 });
}

// POST — Incoming WhatsApp messages
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify this is a message event
    const entry = body?.entry?.[0];
    if (!entry) return new Response("OK", { status: 200 });

    const changes = entry?.changes?.[0];
    if (!changes) return new Response("OK", { status: 200 });

    const value = changes?.value;
    if (!value) return new Response("OK", { status: 200 });

    // Check if this is a message (not a status update)
    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      // This might be a status update (delivered, read, etc.) — ignore
      return new Response("OK", { status: 200 });
    }

    const message = messages[0];
    const from = message.from; // Sender's WhatsApp number (without +)
    const messageType = message.type;

    // Only handle text messages for now
    if (messageType !== "text") {
      // For future: handle voice notes, images, etc.
      return new Response("OK", { status: 200 });
    }

    const text = message.text?.body;
    if (!text) return new Response("OK", { status: 200 });

    // Respond immediately (Meta requires <5s response time)
    // Process the message asynchronously
    processWhatsAppMessage(from, text).catch((err) => {
      console.error("WhatsApp processing error:", err);
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("OK", { status: 200 });
  }
}
