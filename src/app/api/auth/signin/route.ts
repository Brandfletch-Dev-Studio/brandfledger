import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const DB_PASSWORD = encodeURIComponent("Arthur@472003Chibondo");
const SESSION_SECRET = "brandfledger-session-secret-2026";

function createSessionToken(userId: string, email: string): string {
  const payload = { userId, email, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

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

    // Verify credentials against auth.users using bcrypt
    const { rows } = await client.query(
      `SELECT id, email, encrypted_password, raw_user_meta_data->>'full_name' as full_name
       FROM auth.users 
       WHERE email = $1 AND email_confirmed_at IS NOT NULL`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Check if user exists but email not confirmed
      const { rows: unconfirmed } = await client.query(
        `SELECT id FROM auth.users WHERE email = $1 AND email_confirmed_at IS NULL`,
        [email.toLowerCase().trim()]
      );
      if (unconfirmed.length > 0) {
        await client.end();
        return NextResponse.json({ error: "Please confirm your email first" }, { status: 401 });
      }
      await client.end();
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = rows[0];

    // Verify password using crypt() function (PostgreSQL bcrypt)
    const { rows: pwCheck } = await client.query(
      "SELECT $1 = crypt($2, $3) as match",
      [true, password, user.encrypted_password]
    );

    // Also try with the password as the crypt input
    let passwordValid = false;
    if (pwCheck[0]?.match) {
      passwordValid = true;
    } else {
      // Try direct crypt comparison
      const { rows: pwCheck2 } = await client.query(
        "SELECT crypt($1, $2) = $2 as match",
        [password, user.encrypted_password]
      );
      passwordValid = pwCheck2[0]?.match || false;
    }

    if (!passwordValid) {
      // Try one more way: use pgcrypto's crypt
      const { rows: pwCheck3 } = await client.query(
        `SELECT (encrypted_password = crypt($1, encrypted_password)) as match FROM auth.users WHERE email = $2`,
        [password, email.toLowerCase().trim()]
      );
      passwordValid = pwCheck3[0]?.match || false;
    }

    if (!passwordValid) {
      await client.end();
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Get user's businesses
    const { rows: businesses } = await client.query(
      "SELECT id, name, currency FROM businesses WHERE owner_id = $1 ORDER BY created_at",
      [user.id]
    );

    await client.end();

    // Create session token
    const sessionToken = createSessionToken(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, fullName: user.full_name },
      businesses,
      sessionToken,
    });

    // Set session cookie
    response.cookies.set("brandfledger_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    try { await client.end(); } catch {}
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
