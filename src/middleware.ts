import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";

const SESSION_SECRET = "brandfledger-session-secret-2026";
const PROJECT_REF = "qgsaycsdoclsiwrsfaco";
const DB_PASSWORD = encodeURIComponent("Arthur@472003Chibondo");

function verifySessionToken(token: string): { userId: string; email: string } | null {
  try {
    const [body, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
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
    const session = verifySessionToken(sessionCookie);
    if (session) {
      // Valid session - allow through
      return NextResponse.next();
    }
  }

  // Also check for Supabase auth cookie (backward compat)
  const sbCookie = request.cookies.get("sb-access-token")?.value;
  if (sbCookie) {
    // Let the page handle Supabase auth
    return NextResponse.next();
  }

  // No valid session - redirect to auth
  const redirectUrl = new URL("/auth", request.url);
  redirectUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!auth|api|_next/static|_next/image|favicon.ico).*)"],
};
