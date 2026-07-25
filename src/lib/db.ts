import { cookies } from "next/headers";
import crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg") as { Pool: new (opts: any) => any };

const SESSION_SECRET = process.env.SESSION_SECRET!;

// ─── Connection Pool ────────────────────────────────────────────────────────────
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

// ─── Auth ───────────────────────────────────────────────────────────────────────
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

// ─── Query ──────────────────────────────────────────────────────────────────────
export async function query(text: string, params?: any[]) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
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
