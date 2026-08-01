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
    // Fetch user from profiles table (replaces fragile auth.admin API)
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${session.userId}&select=id,email,full_name,subscription_status,plan,trial_ends_at,subscription_ends_at&limit=1`,
      { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    );

    if (!profileRes.ok) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const profileData = (await profileRes.json())[0];
    if (!profileData) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name || "",
        subscription_status: profileData.subscription_status,
        plan: profileData.plan,
        trial_ends_at: profileData.trial_ends_at,
        subscription_ends_at: profileData.subscription_ends_at,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
