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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    // 1. Create user via Supabase Auth Admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      if (errData.error_code === "email_exists") {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: errData.msg || "Failed to create account" }, { status: 400 });
    }

    const userData = await createRes.json();
    const userId = userData.id;
    const userEmail = userData.email;

    // 2. Create account record via Supabase REST API
    const now = new Date().toISOString();
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    await fetch(`${supabaseUrl}/rest/v1/accounts`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        subscription_status: "trial",
        trial_ends_at: trialEnds,
      }),
    });

    // 3. Create business if provided
    if (businessName) {
      const bizId = crypto.randomUUID();
      await fetch(`${supabaseUrl}/rest/v1/businesses`, {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          id: bizId,
          name: businessName,
          currency: "MWK",
          invoice_prefix: "INV",
          owner_id: userId,
          created_at: now,
        }),
      });
    }

    // 4. Fetch businesses
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

    // 5. Create session token
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
