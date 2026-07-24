import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const PASSWORD = encodeURIComponent("Arthur@472003Chibondo");

function createJWT(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export async function GET() {
  const pg = await import("pg");
  const Client = pg.Client;

  const connStr = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
  const client = new (Client as any)({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    
    // Get JWT secret from auth.config
    const { rows } = await client.query("SELECT secret FROM auth.config WHERE id = 'jwt'");
    const jwtSecret: string = rows[0]?.secret;
    
    // Get API keys from vault (Supabase stores them here)
    let anonKey: string | null = null;
    let serviceRoleKey: string | null = null;
    try {
      const { rows: vaultRows } = await client.query(`
        SELECT name, value FROM vault.decrypted_secrets 
        WHERE name IN ('anon_key', 'service_role_key')
      `);
      for (const row of vaultRows) {
        if (row.name === 'anon_key') anonKey = row.value;
        if (row.name === 'service_role_key') serviceRoleKey = row.value;
      }
    } catch {
      // vault might not have the keys, try another approach
    }

    // If we don't have keys from vault, generate them from the JWT secret
    if (!anonKey || !serviceRoleKey) {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (10 * 365 * 24 * 60 * 60); // 10 years
      
      anonKey = createJWT({
        role: "anon",
        iss: "supabase",
        ref: PROJECT_REF,
        iat: now,
        exp,
      }, jwtSecret);
      
      serviceRoleKey = createJWT({
        role: "service_role",
        iss: "supabase",
        ref: PROJECT_REF,
        iat: now,
        exp,
      }, jwtSecret);
    }
    
    // Also check what tables exist
    const { rows: tables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    // Check if user exists in auth
    const { rows: users } = await client.query(
      "SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5"
    );
    
    await client.end();

    return NextResponse.json({
      success: true,
      jwtSecret: jwtSecret?.substring(0, 20) + "...",
      anonKey,
      serviceRoleKey,
      tables: tables.map((r: any) => r.table_name),
      users: users.map((r: any) => ({ email: r.email, created: r.created_at })),
    });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
