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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // 1. Authenticate via Supabase Auth API (password grant)
    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });

    if (!authRes.ok) {
      const authData = await authRes.json();
      return NextResponse.json(
        { error: authData.message || authData.error_description || "Invalid email or password" },
        { status: 401 }
      );
    }

    const authData = await authRes.json();
    const userId = authData.user.id;
    const userEmail = authData.user.email;
    const fullName = authData.user.user_metadata?.full_name || "";

    // 2. Fetch businesses via Supabase REST API
    const bizRes = await fetch(`${supabaseUrl}/rest/v1/businesses?owner_id=eq.${userId}&select=id,name,currency&order=created_at.asc`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    });

    let businesses = [];
    if (bizRes.ok) {
      businesses = await bizRes.json();
    }

    // 3. Create session token
    const sessionToken = createSessionToken(userId, userEmail);

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email: userEmail, fullName },
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
    console.error("Signin error:", err.message);
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
