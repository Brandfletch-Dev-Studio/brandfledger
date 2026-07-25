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
  const { email, password } = await request.json();

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

    const { rows } = await client.query(
      `SELECT
         id,
         email,
         raw_user_meta_data->>'full_name' AS full_name,
         (encrypted_password = crypt($2, encrypted_password)) AS password_ok
       FROM auth.users
       WHERE email = $1`,
      [email.toLowerCase().trim(), password]
    );

    if (rows.length === 0) {
      await client.end();
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const user = rows[0];
    if (!user.password_ok) {
      await client.end();
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const { rows: businesses } = await client.query(
      "SELECT id, name, currency FROM businesses WHERE owner_id = $1 ORDER BY created_at",
      [user.id]
    );

    await client.end();

    const sessionToken = createSessionToken(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, fullName: user.full_name },
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
    console.error("Signin error:", err.message);
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
