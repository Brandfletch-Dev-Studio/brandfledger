import { cookies } from "next/headers";
import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg") as { Pool: new (opts: any) => any };

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const DB_PASSWORD = encodeURIComponent("Arthur@472003Chibondo");
const SESSION_SECRET = "brandfledger-session-secret-2026";

// ─── Connection Pool ───────────────────────────────────────────────────────────
// Re-used across requests within the same serverless instance — cuts 400-600ms
// of connect/disconnect overhead that the old Client approach paid per call.
let _pool: any = null;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    _pool.on("error", () => { _pool = null; });
  }
  return _pool;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
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

// ─── Query ─────────────────────────────────────────────────────────────────────
export async function query(text: string, params?: any[]) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
export async function getUserBusinesses(userId: string) {
  return query(
    "SELECT id, name, currency, invoice_prefix, address, phone, email, logo_url FROM businesses WHERE owner_id = $1 ORDER BY created_at",
    [userId]
  );
}

export async function getDefaultBusinessId(userId: string) {
  const businesses = await getUserBusinesses(userId);
  return businesses[0] || null;
}
