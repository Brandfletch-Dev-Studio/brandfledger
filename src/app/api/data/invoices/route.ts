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

    const [invoices, customers, products, business] = await Promise.all([
      query("SELECT * FROM invoices WHERE business_id = $1 ORDER BY issue_date DESC NULLS LAST, created_at DESC", [businessId]),
      query("SELECT id, name, email, phone FROM customers WHERE business_id = $1 ORDER BY name", [businessId]),
      query("SELECT id, name, price, cost FROM products WHERE business_id = $1 AND is_active = true ORDER BY name", [businessId]),
      query("SELECT * FROM businesses WHERE id = $1", [businessId]),
    ]);

    return NextResponse.json({
      business: business[0],
      invoices,
      customers,
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
    const businessId = await getBusinessId(user.userId, body.business_id);
    if (!businessId) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { customer_id, customer_name, issue_date, due_date, status, notes, items, tax_rate } = body;

    // Generate invoice number
    const biz = await query("SELECT invoice_prefix FROM businesses WHERE id = $1", [businessId]);
    const prefix = biz[0]?.invoice_prefix || "INV";
    const count = await query("SELECT COUNT(*) as count FROM invoices WHERE business_id = $1", [businessId]);
    const num = parseInt(count[0].count) + 1;
    const year = new Date().getFullYear();
    const invNumber = `${prefix}-${year}-${String(num).padStart(4, "0")}`;

    // Calculate totals and build items JSONB
    let subtotal = 0;
    const processedItems = (items || []).map((item: any, idx: number) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      return {
        product_id: item.product_id || null,
        name: item.description || item.name || "",
        description: item.description || "",
        quantity: qty,
        unit_price: price,
        total: lineTotal,
        sort_order: idx,
      };
    });

    const taxAmount = subtotal * (parseFloat(tax_rate) || 0) / 100;
    const total = subtotal + taxAmount;

    const result = await query(
      `INSERT INTO invoices (business_id, customer_id, invoice_number, status, issue_date, due_date, items, subtotal, tax_rate, tax_amount, total, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [businessId, customer_id || null, invNumber, status || "draft",
       issue_date || new Date().toISOString().split("T")[0],
       due_date || null,
       JSON.stringify(processedItems),
       subtotal,
       parseFloat(tax_rate) || 0,
       taxAmount,
       total,
       notes || null]
    );

    const invoice = result[0];

    // Update customer total_invoiced
    if (customer_id) {
      await query(
        `UPDATE customers SET total_invoiced = total_invoiced + $1, updated_at = NOW() WHERE id = $2`,
        [total, customer_id]
      );
    }

    return NextResponse.json({ invoice });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, due_date } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Verify ownership
    const ownership = await query(
      "SELECT i.id FROM invoices i JOIN businesses b ON b.id = i.business_id WHERE i.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status) {
      await query("UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
    }

    if (notes !== undefined || due_date !== undefined) {
      await query(
        `UPDATE invoices SET notes = COALESCE($1, notes), due_date = COALESCE($2, due_date), updated_at = NOW() WHERE id = $3`,
        [notes || null, due_date || null, id]
      );
    }

    const updated = await query("SELECT * FROM invoices WHERE id = $1", [id]);
    return NextResponse.json({ invoice: updated[0] });
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
      "SELECT i.id FROM invoices i JOIN businesses b ON b.id = i.business_id WHERE i.id = $1 AND b.owner_id = $2",
      [id, user.userId]
    );
    if (ownership.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query("DELETE FROM invoices WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
