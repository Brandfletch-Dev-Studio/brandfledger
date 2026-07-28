import { NextResponse, type NextRequest } from "next/server";

// Middleware runs on Edge runtime — use Web Crypto API (no Node crypto)
async function verifySessionToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const secret = process.env.SESSION_SECRET!;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
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

const PUBLIC_ROUTES = ["/", "/login", "/register", "/auth", "/pricing", "/privacy", "/terms", "/invoices/view"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get("brandfledger_session")?.value;
  const hasValidSession = sessionCookie ? !!(await verifySessionToken(sessionCookie)) : false;

  if ((pathname.startsWith("/auth") || pathname === "/login" || pathname === "/register") && hasValidSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/logo")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.next();
  }

  if (hasValidSession) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

