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

    const [products, categories, business] = await Promise.all([
      query("SELECT * FROM products WHERE business_id = $1 ORDER BY name", [businessId]),
      query("SELECT * FROM categories WHERE business_id = $1 AND (type = 'income' OR type = 'both') ORDER BY name", [businessId]),
      query("SELECT * FROM businesses WHERE id = $1", [businessId]),
    ]);

    return NextResponse.json({ products, categories, business: business[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const businessId = await getBusinessId(user.userId, body.business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { name, description, price, cost, category_id, unit, is_active } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    // Calculate profit margin
    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(cost) || 0;
    const profitMargin = parsedPrice > 0 ? ((parsedPrice - parsedCost) / parsedPrice * 100) : 0;

    const result = await query(
      `INSERT INTO products (business_id, name, description, price, cost, category_id, unit, is_active, profit_margin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [businessId, name.trim(), description || null, parsedPrice, parsedCost, category_id || null, unit || null, is_active ?? true, profitMargin]
    );
    return NextResponse.json({ product: result[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, name, description, price, cost, category_id, unit, is_active } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership
    const ownership = await query(
      "SELECT p.id FROM products p JOIN businesses b ON b.id = p.business_id WHERE p.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsedPrice = parseFloat(price) || 0;
    const parsedCost = parseFloat(cost) || 0;
    const profitMargin = parsedPrice > 0 ? ((parsedPrice - parsedCost) / parsedPrice * 100) : 0;

    const result = await query(
      `UPDATE products SET name=$1, description=$2, price=$3, cost=$4, category_id=$5, unit=$6, is_active=$7, profit_margin=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name?.trim(), description || null, parsedPrice, parsedCost, category_id || null, unit || null, is_active ?? true, profitMargin, id]
    );
    return NextResponse.json({ product: result[0] });
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
      "SELECT p.id FROM products p JOIN businesses b ON b.id = p.business_id WHERE p.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query("DELETE FROM products WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
