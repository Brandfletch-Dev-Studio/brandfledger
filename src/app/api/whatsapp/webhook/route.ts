// Brandfledger WhatsApp Finance Manager — Webhook Handler
// GET: Meta webhook verification (challenge echo)
// POST: Incoming WhatsApp messages (with optional HMAC-SHA256 signature verification)

import crypto from "crypto";
import { processWhatsAppMessage } from "@/lib/whatsapp/agent";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Fetch a credential from platform_settings.
 * Handles both { value: "plain" } and { encoded: "base64" } formats.
 */
async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (!data?.value) return null;
    if (data.value.value) return data.value.value as string;
    if (data.value.encoded) {
      try { return Buffer.from(data.value.encoded, "base64").toString("utf-8"); }
      catch { return null; }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── GET: Webhook Verification ───────────────────────────────────────
// Meta sends: hub.mode=subscribe, hub.verify_token=xxx, hub.challenge=xxx
// We must echo back the challenge if the token matches.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe") {
    return new Response("Not Found", { status: 404 });
  }

  if (!token || !challenge) {
    return new Response("Bad Request — missing token or challenge", { status: 400 });
  }

  const storedToken = await getCredential("whatsapp_verify_token");

  if (!storedToken) {
    console.error("[WhatsApp Webhook] No verify token configured in platform_settings");
    return new Response("Forbidden — token not configured", { status: 403 });
  }

  if (token === storedToken) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  console.warn("[WhatsApp Webhook] Token mismatch — received:", token, "expected:", storedToken.slice(0, 8) + "...");
  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Incoming Messages ────────────────────────────────────────
// Meta sends message notifications and status updates.
// We verify the HMAC-SHA256 signature if the app secret is configured.
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // ── Signature verification (if app secret is configured) ──
    const appSecret = await getCredential("whatsapp_app_secret");
    if (appSecret) {
      const signature = request.headers.get("X-Hub-Signature-256");
      if (!signature) {
        console.warn("[WhatsApp Webhook] Missing X-Hub-Signature-256 header");
        return new Response("Unauthorized", { status: 401 });
      }

      const expectedSig = "sha256=" + crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSig) {
        console.warn("[WhatsApp Webhook] Signature mismatch");
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      console.warn("[WhatsApp Webhook] App secret not configured — skipping signature verification");
    }

    // ── Parse the payload ──
    const body = JSON.parse(rawBody);
    const entry = body?.entry?.[0];
    if (!entry) return new Response("OK", { status: 200 });

    const changes = entry?.changes?.[0];
    if (!changes) return new Response("OK", { status: 200 });

    const value = changes?.value;
    if (!value) return new Response("OK", { status: 200 });

    // ── Handle status callbacks (sent, delivered, read) — acknowledge and ignore ──
    const statuses = value?.statuses;
    if (statuses && statuses.length > 0) {
      // Status updates don't need processing — just acknowledge
      return new Response("OK", { status: 200 });
    }

    // ── Handle incoming messages ──
    const messages = value?.messages;
    if (!messages || messages.length === 0) {
      return new Response("OK", { status: 200 });
    }

    const message = messages[0];
    const from = message.from;
    const messageType = message.type;

    // Only process text messages for now
    if (messageType !== "text") {
      console.log(`[WhatsApp Webhook] Non-text message type: ${messageType} from ${from}`);
      return new Response("OK", { status: 200 });
    }

    const text = message.text?.body;
    if (!text) return new Response("OK", { status: 200 });

    // Respond immediately (Meta requires <5s response time)
    // Process the message asynchronously
    processWhatsAppMessage(from, text).catch((err) => {
      console.error("[WhatsApp Webhook] Processing error:", err);
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    // Always return 200 to prevent Meta from retrying
    return new Response("OK", { status: 200 });
  }
}
