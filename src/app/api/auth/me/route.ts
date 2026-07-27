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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // Fetch user via Supabase Auth Admin API
    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${session.userId}`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const userData = await userRes.json();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userData.id,
        email: userData.email,
        fullName: userData.user_metadata?.full_name || "",
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
