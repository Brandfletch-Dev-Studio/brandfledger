import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// This route sets a session cookie and redirects — used for testing
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  
  if (!token) {
    return NextResponse.json({ error: "No token provided" }, { status: 400 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("brandfledger_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
