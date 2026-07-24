import { cookies } from "next/headers";
import crypto from "crypto";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const DB_PASSWORD = encodeURIComponent("Arthur@472003Chibondo");
const SESSION_SECRET = "brandfledger-session-secret-2026";

export function getDbUser() {
  // In Next.js 14, cookies() is synchronous — do NOT await it
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

export async function query(text: string, params?: any[]) {
  const pg = await import("pg");
  const Client = pg.Client;
  
  const connStr = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
  const client = new (Client as any)({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    const result = await client.query(text, params);
    await client.end();
    return result.rows;
  } catch (err: any) {
    try { await client.end(); } catch {}
    throw err;
  }
}

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
