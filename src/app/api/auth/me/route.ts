import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifySessionToken(token: string): { userId: string; email: string } | null {
  try {
    const SESSION_SECRET = process.env.SESSION_SECRET!;
    const [body, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMap = Object.fromEntries(
    cookieHeader.split(";").map(c => c.trim().split("=").map(decodeURIComponent) as [string, string])
  );

  const sessionCookie = cookieMap["brandfledger_session"];
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = verifySessionToken(sessionCookie);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const pg = await import("pg");
  const Client = pg.Client;
  const client = new (Client as any)({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT id, email, raw_user_meta_data->>'full_name' as full_name FROM auth.users WHERE id = $1",
      [session.userId]
    );
    await client.end();

    if (rows.length === 0) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: { id: rows[0].id, email: rows[0].email, fullName: rows[0].full_name },
    });
  } catch {
    try { await client.end(); } catch {}
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
