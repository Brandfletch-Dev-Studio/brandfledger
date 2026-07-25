import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createSessionToken(userId: string, email: string): string {
  const SESSION_SECRET = process.env.SESSION_SECRET!;
  const payload = { userId, email, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function POST(request: Request) {
  const { email, password, fullName, businessName } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const pg = await import("pg");
  const Client = pg.Client;

  const client = new (Client as any)({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();

    const { rows: existing } = await client.query(
      "SELECT id FROM auth.users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      await client.end();
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { rows: pwRows } = await client.query(
      "SELECT crypt($1, gen_salt('bf', 10)) as hash",
      [password]
    );
    const hashedPassword = pwRows[0].hash;

    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        $2, $3, $4, $5, $6, '{}'::jsonb, $7::jsonb)`,
      [userId, email.toLowerCase().trim(), hashedPassword, now, now, now, JSON.stringify({ full_name: fullName || "" })]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        subscription_status TEXT NOT NULL DEFAULT 'trial',
        plan TEXT,
        trial_ends_at TIMESTAMPTZ,
        subscription_ends_at TIMESTAMPTZ,
        amount NUMERIC,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(
      `INSERT INTO accounts (user_id, subscription_status, trial_ends_at)
       VALUES ($1, 'trial', $2::timestamptz + INTERVAL '14 days')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );

    if (businessName) {
      const bizId = crypto.randomUUID();
      await client.query(
        `INSERT INTO businesses (id, name, currency, invoice_prefix, owner_id, created_at)
         VALUES ($1, $2, 'MWK', 'INV', $3, $4)`,
        [bizId, businessName, userId, now]
      );
    }

    const { rows: businesses } = await client.query(
      "SELECT id, name, currency FROM businesses WHERE owner_id = $1",
      [userId]
    );

    await client.end();

    const sessionToken = createSessionToken(userId, email.toLowerCase().trim());

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email: email.toLowerCase().trim(), fullName },
      businesses,
    });

    response.cookies.set("brandfledger_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
