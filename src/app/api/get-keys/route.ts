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
    
    const results: Record<string, unknown> = {};
    
    // 1. Try auth.instances
    try {
      const { rows } = await client.query("SELECT * FROM auth.instances LIMIT 5");
      results.authInstances = rows;
    } catch (e: any) {
      results.authInstancesError = e.message;
    }
    
    // 2. Check vault.decrypted_secrets columns
    try {
      const { rows } = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'vault' AND table_name = 'decrypted_secrets'");
      results.vaultColumns = rows;
    } catch (e: any) {
      results.vaultColumnsError = e.message;
    }
    
    // 3. Try vault with correct columns
    try {
      const { rows } = await client.query("SELECT * FROM vault.decrypted_secrets LIMIT 10");
      results.vaultSecrets = rows.map((r: any) => {
        // Mask values partially
        const masked: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (typeof v === 'string' && v.length > 50) {
            masked[k] = v.substring(0, 30) + '...';
          } else {
            masked[k] = v;
          }
        }
        return masked;
      });
    } catch (e: any) {
      results.vaultSecretsError = e.message;
    }
    
    // 4. Try pg_catalog for JWT-related settings
    try {
      const { rows } = await client.query("SELECT name, setting FROM pg_settings WHERE name LIKE '%jwt%' OR name LIKE '%auth%' OR name LIKE '%supabase%'");
      results.pgSettings = rows;
    } catch (e: any) {
      results.pgSettingsError = e.message;
    }
    
    // 5. Try to get the JWT secret from the auth schema's config function
    try {
      const { rows } = await client.query("SELECT auth.get_jwt_secret() as secret");
      if (rows[0]?.secret) {
        results.jwtSecret = rows[0].secret;
      }
    } catch (e: any) {
      results.jwtSecretError = e.message;
    }
    
    // 6. Try to get config from auth.schema_migrations or similar
    try {
      const { rows } = await client.query("SELECT * FROM auth.schema_migrations ORDER BY version DESC LIMIT 3");
      results.schemaMigrations = rows;
    } catch (e: any) {
      results.schemaMigrationsError = e.message;
    }
    
    // 7. Try SHOW config_file or similar to find where config lives
    try {
      const { rows } = await client.query("SELECT current_setting('app.supabase_jwt_secret', true) as secret");
      results.appSetting = rows[0]?.secret || 'not set';
    } catch (e: any) {
      results.appSettingError = e.message;
    }
    
    // 8. Direct approach: check all tables in auth for config-like data
    try {
      const { rows } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' AND table_name LIKE '%config%' OR table_name LIKE '%setting%'");
      results.configTables = rows;
    } catch (e: any) {
      results.configTablesError = e.message;
    }
    
    // Generate keys if we found the JWT secret
    let anonKey: string | null = null;
    let serviceRoleKey: string | null = null;
    let jwtSecret: string | null = null;
    
    if (results.jwtSecret) {
      jwtSecret = results.jwtSecret as string;
    }
    
    if (!jwtSecret && results.vaultSecrets) {
      // Try to find a JWT secret in vault
      for (const secret of results.vaultSecrets as any[]) {
        if (secret.name && (secret.name.includes('jwt') || secret.name.includes('secret'))) {
          // Need to get the full value
        }
      }
    }
    
    if (jwtSecret) {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (10 * 365 * 24 * 60 * 60);
      
      anonKey = createJWT({ role: "anon", iss: "supabase", ref: PROJECT_REF, iat: now, exp }, jwtSecret);
      serviceRoleKey = createJWT({ role: "service_role", iss: "supabase", ref: PROJECT_REF, iat: now, exp }, jwtSecret);
      results.anonKey = anonKey;
      results.serviceRoleKey = serviceRoleKey;
    }
    
    await client.end();
    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
