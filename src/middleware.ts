import { NextResponse, type NextRequest } from "next/server";

const SESSION_SECRET = "brandfledger-session-secret-2026";

// Middleware runs on Edge runtime — use Web Crypto API instead of Node's crypto
async function verifySessionToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    // Use Web Crypto API (available in Edge runtime)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

    // Convert to base64url to compare
    const sigBytes = new Uint8Array(sig);
    let sigBase64 = "";
    for (let i = 0; i < sigBytes.length; i++) {
      sigBase64 += String.fromCharCode(sigBytes[i]);
    }
    sigBase64 = btoa(sigBase64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    if (sigBase64 !== signature) return null;

    // Decode payload
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes, API routes, and static assets
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/" ||
    pathname === "/pricing"
  ) {
    return NextResponse.next();
  }

  // Check for our custom session cookie
  const sessionCookie = request.cookies.get("brandfledger_session")?.value;

  if (sessionCookie) {
    const session = await verifySessionToken(sessionCookie);
    if (session) {
      // Valid session - allow through
      return NextResponse.next();
    }
  }

  // No valid session - redirect to auth
  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!auth|api|_next/static|_next/image|favicon.ico).*)"],
};
