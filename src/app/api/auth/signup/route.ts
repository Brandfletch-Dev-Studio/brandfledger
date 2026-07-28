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
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // ── PRE-FLIGHT: Check for existing email via direct SQL ───────────────────
    // Supabase Auth's own email-uniqueness check is broken — it returns a 500
    // "Database error checking email" instead of the proper "email_exists" code.
    // We pre-check directly against auth.users to give users a clean error message.
    const emailCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/auth_check_email`,
      {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ check_email: normalizedEmail }),
      }
    );

    // If the RPC exists and returned true, the email is taken
    if (emailCheckRes.ok) {
      const alreadyExists = await emailCheckRes.json();
      if (alreadyExists === true) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }
    } else {
      // RPC not available — do a raw SQL check via the management API pattern
      // by querying the REST endpoint for auth.users (service role can see it)
      const rawCheck = await fetch(
        `${supabaseUrl}/rest/v1/accounts?select=user_id&limit=1`,
        {
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
        }
      );
      // We'll use a workaround: query our own accounts table isn't enough.
      // Fall through to let Auth API handle it, but map the error below.
    }

    // ── 1. Create user via Supabase Auth Admin API ────────────────────────────
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" },
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      const errMsg: string = errData.msg || errData.message || "";
      const errCode: string = errData.error_code || "";

      // All known "email already exists" signals from Supabase Auth
      if (
        errCode === "email_exists" ||
        errMsg.toLowerCase().includes("database error checking email") ||
        errMsg.toLowerCase().includes("already been registered") ||
        (errData.code === 422 && errMsg.toLowerCase().includes("email"))
      ) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: errMsg || "Failed to create account" }, { status: 400 });
    }

    const userData = await createRes.json();
    const userId = userData.id;
    const userEmail = userData.email;

    // ── 2. Create account record ──────────────────────────────────────────────
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

    // ── 3. Create business if provided ────────────────────────────────────────
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
          name: businessName.trim(),
          currency: "MWK",
          invoice_prefix: "INV",
          owner_id: userId,
          created_at: now,
        }),
      });
    }

    // ── 4. Fetch businesses ───────────────────────────────────────────────────
    const bizRes = await fetch(
      `${supabaseUrl}/rest/v1/businesses?owner_id=eq.${userId}&select=id,name,currency&order=created_at.asc`,
      { headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` } }
    );
    let businesses: any[] = [];
    if (bizRes.ok) businesses = await bizRes.json();

    // ── 5. Session token & response ───────────────────────────────────────────
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
