import { NextResponse } from "next/server";
import { getDbUser, query } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = getDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  try {
    // Verify current password using bcrypt via Supabase auth
    const bcrypt = await import("bcryptjs");

    const rows = await query(
      "SELECT id, encrypted_password FROM auth.users WHERE id = $1",
      [user.userId]
    );
    if (!rows[0]) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, rows[0].encrypted_password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      "UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2",
      [newHash, user.userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
