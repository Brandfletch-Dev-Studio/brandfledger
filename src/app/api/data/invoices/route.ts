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
      query(
        `SELECT i.*, c.name as customer_name
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.business_id = $1
         ORDER BY i.issue_date DESC NULLS LAST, i.created_at DESC`,
        [businessId]
      ),
      query("SELECT id, name, email, phone FROM customers WHERE business_id = $1 ORDER BY name", [businessId]),
      query("SELECT id, name, price, cost FROM products WHERE business_id = $1 AND is_active = true ORDER BY name", [businessId]),
      query("SELECT * FROM businesses WHERE id = $1", [businessId]),
    ]);

    // Fetch invoice items for each invoice
    const invoiceIds = invoices.map((inv: any) => inv.id);
    let itemsByInvoice: Record<string, any[]> = {};
    if (invoiceIds.length > 0) {
      const items = await query(
        `SELECT * FROM invoice_items WHERE invoice_id = ANY($1::uuid[]) ORDER BY sort_order`,
        [invoiceIds]
      );
      itemsByInvoice = items.reduce((acc: any, item: any) => {
        if (!acc[item.invoice_id]) acc[item.invoice_id] = [];
        acc[item.invoice_id].push(item);
        return acc;
      }, {});
    }

    const invoicesWithItems = invoices.map((inv: any) => ({
      ...inv,
      items: itemsByInvoice[inv.id] || [],
    }));

    return NextResponse.json({
      business: business[0],
      invoices: invoicesWithItems,
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

    const { invoice_number, customer_id, customer_name, issue_date, due_date, status, notes, items, tax_rate } = body;

    // Generate invoice number if not provided
    let invNumber = invoice_number;
    if (!invNumber) {
      const biz = await query("SELECT invoice_prefix FROM businesses WHERE id = $1", [businessId]);
      const prefix = biz[0]?.invoice_prefix || "INV";
      const count = await query("SELECT COUNT(*) as count FROM invoices WHERE business_id = $1", [businessId]);
      const num = parseInt(count[0].count) + 1;
      invNumber = `${prefix}-${String(num).padStart(4, "0")}`;
    }

    // Calculate totals
    let subtotal = 0;
    let totalCost = 0;
    const processedItems = (items || []).map((item: any, idx: number) => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      const cost = parseFloat(item.cost) || 0;
      const lineTotal = qty * price;
      const lineCost = qty * cost;
      subtotal += lineTotal;
      totalCost += lineCost;
      return {
        ...item,
        quantity: qty,
        price,
        cost,
        total: lineTotal,
        sort_order: idx,
      };
    });

    const taxAmount = subtotal * (parseFloat(tax_rate) || 0) / 100;
    const total = subtotal + taxAmount;

    const result = await query(
      `INSERT INTO invoices (business_id, invoice_number, customer_id, customer_name, issue_date, due_date, status, notes, subtotal, tax_rate, tax_amount, total, total_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [businessId, invNumber, customer_id || null, customer_name || null,
       issue_date || new Date().toISOString().split("T")[0],
       due_date || null,
       status || "draft",
       notes || null,
       subtotal,
       parseFloat(tax_rate) || 0,
       taxAmount,
       total,
       totalCost]
    );

    const invoice = result[0];

    // Insert invoice items
    for (const item of processedItems) {
      await query(
        `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, price, cost, total, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [invoice.id, item.product_id || null, item.description, item.quantity, item.price, item.cost, item.total, item.sort_order]
      );
    }

    // Update customer total_invoiced
    if (customer_id) {
      await query(
        `UPDATE customers SET total_invoiced = total_invoiced + $1, updated_at = NOW() WHERE id = $2`,
        [total, customer_id]
      );
    }

    return NextResponse.json({ invoice: { ...invoice, items: processedItems } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, due_date, items, tax_rate, customer_id, customer_name } = body;
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

    if (items !== undefined) {
      // Recalculate and update items
      await query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);
      let subtotal = 0;
      let totalCost = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.price) || 0;
        const cost = parseFloat(item.cost) || 0;
        const lineTotal = qty * price;
        subtotal += lineTotal;
        totalCost += qty * cost;
        await query(
          `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, price, cost, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, item.product_id || null, item.description, qty, price, cost, lineTotal, item.sort_order || 0]
        );
      }
      const taxAmount = subtotal * (parseFloat(tax_rate) || 0) / 100;
      const total = subtotal + taxAmount;
      await query(
        `UPDATE invoices SET subtotal=$1, tax_rate=$2, tax_amount=$3, total=$4, total_cost=$5, updated_at=NOW() WHERE id=$6`,
        [subtotal, parseFloat(tax_rate) || 0, taxAmount, total, totalCost, id]
      );
    }

    if (customer_id !== undefined || customer_name !== undefined || notes !== undefined || due_date !== undefined) {
      await query(
        `UPDATE invoices SET
          customer_id = COALESCE($1, customer_id),
          customer_name = COALESCE($2, customer_name),
          notes = COALESCE($3, notes),
          due_date = COALESCE($4, due_date),
          updated_at = NOW()
         WHERE id = $5`,
        [customer_id || null, customer_name || null, notes || null, due_date || null, id]
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

    await query("DELETE FROM invoice_items WHERE invoice_id = $1", [id]);
    await query("DELETE FROM invoices WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
