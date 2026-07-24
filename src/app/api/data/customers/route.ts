import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getBusinessId(userId: string, requestedId?: string | null) {
  if (requestedId) {
    const ownership = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2", [requestedId, userId]);
    if (ownership.length === 0) return null;
    return requestedId;
  }
  const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [userId]);
  return businesses[0]?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const businessId = await getBusinessId(user.userId, searchParams.get("business_id"));
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const [customers, incomeTx] = await Promise.all([
      query("SELECT * FROM customers WHERE business_id = $1 ORDER BY name", [businessId]),
      query("SELECT id, client_name, amount, cost_amount, profit, date, description, type, payment_method FROM transactions WHERE business_id = $1 AND type = 'income' ORDER BY date DESC", [businessId]),
    ]);

    const business = await query("SELECT * FROM businesses WHERE id = $1", [businessId]);

    return NextResponse.json({ business: business[0], customers, incomeTx });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, email, phone, address, notes, business_id } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const businessId = await getBusinessId(user.userId, business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const result = await query(
      "INSERT INTO customers (business_id, name, email, phone, address, notes, total_invoiced) VALUES ($1,$2,$3,$4,$5,$6,0) RETURNING *",
      [businessId, name.trim(), email || null, phone || null, address || null, notes || null]
    );
    return NextResponse.json({ customer: result[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, name, email, phone, address, notes } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership via business
    const ownership = await query(
      "SELECT c.id FROM customers c JOIN businesses b ON b.id = c.business_id WHERE c.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await query(
      "UPDATE customers SET name=$1, email=$2, phone=$3, address=$4, notes=$5, updated_at=NOW() WHERE id=$6 RETURNING *",
      [name?.trim(), email || null, phone || null, address || null, notes || null, id]
    );
    return NextResponse.json({ customer: result[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const ownership = await query(
      "SELECT c.id FROM customers c JOIN businesses b ON b.id = c.business_id WHERE c.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query("DELETE FROM customers WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
