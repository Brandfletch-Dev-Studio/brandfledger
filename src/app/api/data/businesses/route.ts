import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — list all businesses for the current user
export async function GET() {
  const user = getDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businesses = await query(
    `SELECT id, name, currency, invoice_prefix, address, phone, email, website, business_type, tax_id, logo_url,
            subscription_status, trial_ends_at, subscription_ends_at, created_at
     FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC`,
    [user.userId]
  );

  return NextResponse.json({ businesses });
}

// POST — create a new business
export async function POST(request: Request) {
  const user = getDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, currency = "MWK", invoice_prefix = "INV" } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Business name is required" }, { status: 400 });

  // Count existing businesses (optional limit)
  const existing = await query("SELECT COUNT(*) as count FROM businesses WHERE owner_id = $1", [user.userId]);
  const count = parseInt(existing[0]?.count || "0");
  if (count >= 10) return NextResponse.json({ error: "Maximum 10 businesses per account" }, { status: 400 });

  const result = await query(
    `INSERT INTO businesses (owner_id, name, currency, invoice_prefix, subscription_status, trial_ends_at)
     VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '14 days')
     RETURNING id, name, currency, invoice_prefix, subscription_status, trial_ends_at, created_at`,
    [user.userId, name.trim(), currency, invoice_prefix.toUpperCase()]
  );

  return NextResponse.json({ business: result[0] });
}
