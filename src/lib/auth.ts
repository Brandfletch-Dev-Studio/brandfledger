"use client";
import { useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.authenticated) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { user, loading };
}

// Server-side helper — reads SESSION_SECRET from env, never from source
export function getSessionFromCookie(cookieHeader: string): { userId: string; email: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto");
  const SESSION_SECRET = process.env.SESSION_SECRET!;
  try {
    const cookieMap = Object.fromEntries(
      cookieHeader.split(";").map(c => c.trim().split("=").map(decodeURIComponent) as [string, string])
    );
    const token = cookieMap["brandfledger_session"];
    if (!token) return null;
    const [body, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
