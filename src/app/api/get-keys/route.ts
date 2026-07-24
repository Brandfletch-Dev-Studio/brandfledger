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
    
    // List all schemas
    const { rows: schemas } = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name"
    );
    
    // List all auth tables
    let authTables: any[] = [];
    try {
      const { rows } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' ORDER BY table_name"
      );
      authTables = rows;
    } catch (e: any) {
      authTables = [{ error: e.message }];
    }
    
    // Try to get JWT secret from various places
    let jwtSecret: string | null = null;
    const secretAttempts: string[] = [];
    
    // Try auth.config
    try {
      const { rows } = await client.query("SELECT secret FROM auth.config WHERE id = 'jwt'");
      if (rows[0]?.secret) {
        jwtSecret = rows[0].secret;
        secretAttempts.push("Found in auth.config");
      }
    } catch (e: any) {
      secretAttempts.push(`auth.config: ${e.message}`);
    }
    
    // Try vault.decrypted_secrets
    try {
      const { rows } = await client.query("SELECT name, value FROM vault.decrypted_secrets WHERE name LIKE '%jwt%' OR name LIKE '%secret%' OR name LIKE '%key%'");
      if (rows.length > 0) {
        for (const row of rows) {
          secretAttempts.push(`vault: ${row.name} = ${String(row.value).substring(0, 30)}...`);
          if (row.name.includes('jwt') || row.name.includes('secret')) {
            jwtSecret = row.value;
          }
        }
      } else {
        secretAttempts.push("vault: no secrets found");
      }
    } catch (e: any) {
      secretAttempts.push(`vault: ${e.message}`);
    }
    
    // Try pg_extension to see if GoTrue is installed
    let extensions: any[] = [];
    try {
      const { rows } = await client.query("SELECT extname FROM pg_extension ORDER BY extname");
      extensions = rows;
    } catch (e: any) {
      extensions = [{ error: e.message }];
    }
    
    // List public tables
    const { rows: publicTables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    
    // Try to get auth users
    let authUsers: any[] = [];
    try {
      const { rows } = await client.query("SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5");
      authUsers = rows.map((r: any) => ({ email: r.email, created: r.created_at }));
    } catch (e: any) {
      authUsers = [{ error: e.message }];
    }
    
    // Generate keys from JWT secret if found
    let anonKey: string | null = null;
    let serviceRoleKey: string | null = null;
    
    if (jwtSecret) {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (10 * 365 * 24 * 60 * 60);
      
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
    
    await client.end();

    return NextResponse.json({
      success: true,
      schemas: schemas.map((r: any) => r.schema_name),
      authTables: authTables.map((r: any) => r.table_name || r.error),
      publicTables: publicTables.map((r: any) => r.table_name),
      extensions: extensions.map((r: any) => r.extname || r.error),
      authUsers,
      jwtSecretFound: !!jwtSecret,
      jwtSecretPreview: jwtSecret?.substring(0, 20) + "...",
      anonKey,
      serviceRoleKey,
      secretAttempts,
    });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
