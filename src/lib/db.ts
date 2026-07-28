import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Supabase client - service role, bypasses RLS
export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function getDbUser() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("brandfledger_session")?.value;
  if (!sessionCookie) return null;
  try {
    const [body, signature] = sessionCookie.split(".");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function getUserBusinesses(userId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, currency, invoice_prefix, address, phone, email, logo_url")
    .eq("owner_id", userId)
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function getDefaultBusinessId(userId: string) {
  // BUG FIX: Read the activeBusinessId cookie first, matching business switcher behavior
  try {
    const cookieStore = cookies();
    const cookieId = cookieStore.get("activeBusinessId")?.value;
    if (cookieId) {
      const { data } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", cookieId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (data) return data;
    }
  } catch {}
  
  // Fall back to first business
  const businesses = await getUserBusinesses(userId);
  return businesses[0] || null;
}

export async function verifyBusinessOwnership(businessId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
