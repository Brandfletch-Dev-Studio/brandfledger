// Brandfledger WhatsApp Finance Manager — Webhook Handler
// GET: Meta webhook verification (challenge echo)
// POST: Incoming WhatsApp messages (HMAC-SHA256 signature verification required)

import crypto from "crypto";
import { processWhatsAppMessage } from "@/lib/whatsapp/agent";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Security Constants ────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;       // Reject messages longer than 2K chars
const RATE_LIMIT_WINDOW_MS = 60_000;   // 1 minute window
const RATE_LIMIT_MAX = 10;             // Max messages per number per window
const PROCESSED_IDS_TTL_MS = 300_000;  // 5 min — dedup Meta retries

// ─── In-memory rate limiter (per Vercel instance) ─────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
// ─── Replay protection: track processed message IDs ────────────────────
const processedMessageIds = new Map<string, number>();

/**
 * Timing-safe string comparison to prevent timing attacks on tokens/signatures.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Check rate limit for a phone number.
 * Returns true if the message is allowed, false if rate-limited.
 */
function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phoneNumber);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phoneNumber, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

/**
 * Check if a message ID was already processed (Meta retry dedup).
 * Returns true if this is a duplicate (should skip).
 */
function isDuplicateMessage(messageId: string): boolean {
  const now = Date.now();
  // Clean up old entries
  for (const [id, ts] of processedMessageIds) {
    if (now - ts > PROCESSED_IDS_TTL_MS) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

/**
 * Sanitize a phone number: strip everything except digits.
 */
function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Fetch a credential from platform_settings.
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
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe") return new Response("Not Found", { status: 404 });
  if (!token || !challenge) return new Response("Bad Request", { status: 400 });

  const storedToken = await getCredential("whatsapp_verify_token");
  if (!storedToken) {
    console.error("[WhatsApp Webhook] No verify token configured");
    return new Response("Forbidden", { status: 403 });
  }

  // Timing-safe comparison
  if (timingSafeEqual(token, storedToken)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  console.warn("[WhatsApp Webhook] Token mismatch (timing-safe check failed)");
  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Incoming Messages ────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // ── Signature verification (REQUIRED if app secret is configured) ──
    const appSecret = await getCredential("whatsapp_app_secret");
    if (appSecret) {
      const signature = request.headers.get("X-Hub-Signature-256");
      if (!signature) {
        console.warn("[WhatsApp Webhook] Missing signature header");
        return new Response("Unauthorized", { status: 401 });
      }

      const expectedSig = "sha256=" + crypto
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

      // Timing-safe comparison to prevent timing attacks
      if (!timingSafeEqual(signature, expectedSig)) {
        console.warn("[WhatsApp Webhook] Signature mismatch");
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      // App secret not configured — REFUSE to process (security hardening)
      console.error("[WhatsApp Webhook] CRITICAL: App secret not configured — refusing to process messages");
      return new Response("OK", { status: 200 });
    }

    // ── Parse the payload ──
    const body = JSON.parse(rawBody);
    const entry = body?.entry?.[0];
    if (!entry) return new Response("OK", { status: 200 });

    const changes = entry?.changes?.[0];
    if (!changes) return new Response("OK", { status: 200 });

    const value = changes?.value;
    if (!value) return new Response("OK", { status: 200 });

    // ── Status callbacks — acknowledge and ignore ──
    if (value?.statuses?.length > 0) return new Response("OK", { status: 200 });

    // ── Incoming messages ──
    const messages = value?.messages;
    if (!messages || messages.length === 0) return new Response("OK", { status: 200 });

    const message = messages[0];
    const messageId = message.id;
    const messageType = message.type;

    // ── Replay protection: skip if already processed ──
    if (messageId && isDuplicateMessage(messageId)) {
      console.log("[WhatsApp Webhook] Duplicate message skipped:", messageId);
      return new Response("OK", { status: 200 });
    }

    // ── Only process text messages ──
    if (messageType !== "text") {
      console.log("[WhatsApp Webhook] Non-text type:", messageType);
      return new Response("OK", { status: 200 });
    }

    const text = message.text?.body;
    if (!text) return new Response("OK", { status: 200 });

    // ── Message length cap ──
    if (text.length > MAX_MESSAGE_LENGTH) {
      console.warn(`[WhatsApp Webhook] Message too long (${text.length} chars) from ${message.from}`);
      return new Response("OK", { status: 200 });
    }

    // ── Phone number sanitization ──
    const from = sanitizePhone(message.from);

    // ── Rate limiting ──
    if (!checkRateLimit(from)) {
      console.warn(`[WhatsApp Webhook] Rate limit exceeded for ${from}`);
      return new Response("OK", { status: 200 });
    }

    // ── Process the message ──
    try {
      await processWhatsAppMessage(from, text, messageId);
    } catch (err) {
      console.error("[WhatsApp Webhook] Processing error:", err);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    return new Response("OK", { status: 200 });
  }
}
