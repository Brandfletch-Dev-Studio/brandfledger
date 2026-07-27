import { cookies } from "next/headers";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SESSION_SECRET = process.env.SESSION_SECRET!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Supabase Client (server-side, service role bypasses RLS) ────────────────
export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Auth ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────────────────────────────
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
  const businesses = await getUserBusinesses(userId);
  return businesses[0] || null;
}

// ─── Business ownership verification ─────────────────────────────────────────
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

// ─── Generic query (DEPRECATED — use supabase client directly) ───────────────
// This is kept for backward compatibility with routes not yet migrated.
// It attempts to parse simple SQL patterns and translate to PostgREST calls.
export async function query(text: string, params?: any[]) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows;
}

// ─── Legacy pg Pool (broken pooler — do not use) ─────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg") as { Pool: new (opts: any) => any };
let _pool: any = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    _pool.on("error", () => { _pool = null; });
  }
  return _pool;
}
