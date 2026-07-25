import { NextResponse, type NextRequest } from "next/server";

const SESSION_SECRET = "brandfledger-session-secret-2026";

// Middleware runs on Edge runtime — use Web Crypto API instead of Node's crypto
async function verifySessionToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));

    const sigBytes = new Uint8Array(sig);
    let sigBase64 = "";
    for (let i = 0; i < sigBytes.length; i++) {
      sigBase64 += String.fromCharCode(sigBytes[i]);
    }
    sigBase64 = btoa(sigBase64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    if (sigBase64 !== signature) return null;

    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/register", "/auth", "/pricing", "/privacy", "/terms"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for our custom session cookie
  const sessionCookie = request.cookies.get("brandfledger_session")?.value;
  const hasValidSession = sessionCookie ? !!(await verifySessionToken(sessionCookie)) : false;

  // If on a public auth route and already authenticated → redirect to dashboard
  if ((pathname.startsWith("/auth") || pathname === "/login" || pathname === "/register") && hasValidSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Allow API routes and static assets through without checks
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/logo")
  ) {
    return NextResponse.next();
  }

  // Public routes — allow through without session
  if (PUBLIC_ROUTES.some(route => pathname === route) || PUBLIC_ROUTES.some(route => pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  // All other pages require a valid session
  if (hasValidSession) {
    return NextResponse.next();
  }

  // No valid session — redirect to login
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
