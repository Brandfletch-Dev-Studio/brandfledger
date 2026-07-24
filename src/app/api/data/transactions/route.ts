import { NextResponse } from "next/server";
import { query, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyOwnership(businessId: string, userId: string) {
  const ownership = await query("SELECT id FROM businesses WHERE id = $1 AND owner_id = $2", [businessId, userId]);
  return ownership.length > 0;
}

export async function GET(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let businessId: string | null = searchParams.get("business_id");
    
    if (!businessId) {
      const businesses = await query("SELECT id FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
      if (businesses.length === 0) return NextResponse.json({ error: "No business found" }, { status: 404 });
      businessId = businesses[0].id;
    }

    if (!businessId || !await verifyOwnership(businessId, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [transactions, categories, products] = await Promise.all([
      query("SELECT * FROM transactions WHERE business_id = $1 ORDER BY date DESC, created_at DESC", [businessId]),
      query("SELECT * FROM categories WHERE business_id = $1 ORDER BY sort_order, name", [businessId]),
      query("SELECT * FROM products WHERE business_id = $1 AND is_active = true ORDER BY name", [businessId]),
    ]);

    const business = await query("SELECT * FROM businesses WHERE id = $1", [businessId]);

    return NextResponse.json({
      business: business[0],
      transactions,
      categories,
      products,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, business_id, ...data } = body;

    if (!business_id) return NextResponse.json({ error: "business_id required" }, { status: 400 });
    if (!await verifyOwnership(business_id, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (action === "create_transaction") {
      const { type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;
      const result = await query(
        `INSERT INTO transactions (business_id, type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [business_id, type, client_name || null, vendor_name || null, description, amount, cost_qty || 0, cost_amount || 0, category_id || null, category_name || null, product_id || null, payment_method || "cash", date]
      );
      return NextResponse.json({ transaction: result[0] });
    }

    if (action === "update_transaction") {
      const { id, type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;
      const result = await query(
        `UPDATE transactions SET
          type = COALESCE($1, type),
          client_name = COALESCE($2, client_name),
          vendor_name = COALESCE($3, vendor_name),
          description = COALESCE($4, description),
          amount = COALESCE($5, amount),
          cost_qty = COALESCE($6, cost_qty),
          cost_amount = COALESCE($7, cost_amount),
          category_id = COALESCE($8, category_id),
          category_name = COALESCE($9, category_name),
          product_id = COALESCE($10, product_id),
          payment_method = COALESCE($11, payment_method),
          date = COALESCE($12, date),
          updated_at = NOW()
         WHERE id = $13 AND business_id = $14 RETURNING *`,
        [type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date, id, business_id]
      );
      if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transaction: result[0] });
    }

    if (action === "create_category") {
      const { name, type, color } = data;
      const result = await query(
        `INSERT INTO categories (business_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING *`,
        [business_id, name, type, color || null]
      );
      return NextResponse.json({ category: result[0] });
    }

    if (action === "delete_transaction") {
      const { id } = data;
      await query("DELETE FROM transactions WHERE id = $1 AND business_id = $2", [id, business_id]);
      return NextResponse.json({ success: true });
    }

    if (action === "delete_category") {
      const { id } = data;
      await query("DELETE FROM categories WHERE id = $1 AND business_id = $2", [id, business_id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, business_id, ...data } = body;
    if (!id || !business_id) return NextResponse.json({ error: "id and business_id required" }, { status: 400 });
    if (!await verifyOwnership(business_id, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date } = data;
    const result = await query(
      `UPDATE transactions SET
        type = COALESCE($1, type),
        client_name = COALESCE($2, client_name),
        vendor_name = COALESCE($3, vendor_name),
        description = COALESCE($4, description),
        amount = COALESCE($5, amount),
        cost_qty = COALESCE($6, cost_qty),
        cost_amount = COALESCE($7, cost_amount),
        category_id = COALESCE($8, category_id),
        category_name = COALESCE($9, category_name),
        product_id = COALESCE($10, product_id),
        payment_method = COALESCE($11, payment_method),
        date = COALESCE($12, date),
        updated_at = NOW()
       WHERE id = $13 AND business_id = $14 RETURNING *`,
      [type, client_name, vendor_name, description, amount, cost_qty, cost_amount, category_id, category_name, product_id, payment_method, date, id, business_id]
    );
    if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ transaction: result[0] });
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
    const businessId = searchParams.get("business_id");
    if (!id || !businessId) return NextResponse.json({ error: "id and business_id required" }, { status: 400 });
    if (!await verifyOwnership(businessId, user.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await query("DELETE FROM transactions WHERE id = $1 AND business_id = $2", [id, businessId]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
