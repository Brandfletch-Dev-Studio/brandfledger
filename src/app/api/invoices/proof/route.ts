import { NextResponse } from "next/server";
import { supabase, getDbUser } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/invoices/proof
 * Public endpoint — accepts a manual proof of payment upload for an invoice.
 * The proof is stored as base64 in invoice_payments and the invoice is marked
 * as "pending_verification" so the business owner can review and confirm.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoice_id, proof_base64, proof_filename, proof_content_type, payer_name, payer_phone, notes, amount } = body as {
      invoice_id: string;
      proof_base64: string;
      proof_filename?: string;
      proof_content_type?: string;
      payer_name?: string;
      payer_phone?: string;
      notes?: string;
      amount?: number;
    };

    if (!invoice_id) return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_id)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }
    if (!proof_base64) return NextResponse.json({ error: "Proof of payment is required" }, { status: 400 });

    // Validate file size (base64 string length / 1.37 ≈ raw bytes, limit ~5MB)
    const approxBytes = proof_base64.length / 1.37;
    if (approxBytes > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });
    }

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    const contentType = proof_content_type || "image/jpeg";
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ error: "Unsupported file type. Use JPG, PNG, WebP, or PDF." }, { status: 400 });
    }

    // Fetch the invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, business_id, invoice_number, total, amount_paid, balance_due, status")
      .eq("id", invoice_id)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const balanceDue = Number(invoice.balance_due || (invoice.total - (invoice.amount_paid || 0)));
    if (balanceDue <= 0) {
      return NextResponse.json({ error: "This invoice is already fully paid" }, { status: 400 });
    }

    const paymentAmount = amount || balanceDue;

    // Create payment record with proof
    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoice.id,
        business_id: invoice.business_id,
        payment_method: "manual",
        amount: paymentAmount,
        status: "pending_verification",
        proof_base64,
        proof_filename: proof_filename || "proof-of-payment",
        proof_content_type: contentType,
        payer_name: payer_name || null,
        payer_phone: payer_phone || null,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (payErr) throw payErr;

    // Update invoice status to pending_verification (so owner knows to review)
    await supabase.from("invoices").update({
      status: "pending_verification",
      proof_url: `internal:${payment.id}`,
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);

    return NextResponse.json({
      success: true,
      payment_id: payment.id,
      invoice_number: invoice.invoice_number,
      message: "Proof of payment uploaded. The business owner will verify and confirm your payment shortly.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/invoices/proof
 * Authenticated endpoint — business owner approves or rejects a manual proof.
 * If approved: marks invoice as paid, creates income transaction, updates balance.
 * If rejected: reverts invoice to "sent", marks proof as rejected.
 */
export async function PATCH(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { payment_id, action } = body as { payment_id: string; action: "approve" | "reject" };

    if (!payment_id) return NextResponse.json({ error: "payment_id required" }, { status: 400 });
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    // Fetch payment record
    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("id", payment_id)
      .maybeSingle();
    if (payErr) throw payErr;
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (payment.status !== "pending_verification") {
      return NextResponse.json({ error: "Payment already processed" }, { status: 400 });
    }

    // Verify ownership
    const { data: biz } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", payment.business_id)
      .eq("owner_id", user.userId)
      .maybeSingle();
    if (!biz) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Fetch invoice
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, business_id, invoice_number, total, amount_paid, status, customer_id, items")
      .eq("id", payment.invoice_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    if (action === "approve") {
      // Update invoice
      const newAmountPaid = Number(invoice.amount_paid || 0) + Number(payment.amount);
      const newBalanceDue = Number(invoice.total) - newAmountPaid;
      const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

      await supabase.from("invoices").update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq("id", invoice.id);

      // Mark payment as completed
      await supabase.from("invoice_payments").update({
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", payment_id);

      // Create income transaction
      const invItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
      const totalCost = invItems.reduce((sum: number, item: any) => {
        const qty = parseFloat(item.quantity) || 1;
        const itemCost = parseFloat(item.cost) || 0;
        return sum + qty * itemCost;
      }, 0);

      let clientName: string | null = null;
      if (invoice.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name")
          .eq("id", invoice.customer_id)
          .maybeSingle();
        clientName = cust?.name || null;
      }
      if (!clientName) clientName = `Invoice ${invoice.invoice_number}`;

      await supabase.from("transactions").insert({
        business_id: invoice.business_id,
        type: "income",
        client_name: clientName,
        description: `Manual payment for ${invoice.invoice_number}`,
        amount: Number(payment.amount),
        cost_amount: totalCost,
        profit: Number(payment.amount) - totalCost,
        payment_method: "manual",
        date: new Date().toISOString().split("T")[0],
        invoice_id: invoice.id,
      });

      return NextResponse.json({
        success: true,
        action: "approved",
        invoice_status: newStatus,
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
      });
    } else {
      // Reject — revert invoice to sent
      await supabase.from("invoices").update({
        status: "sent",
        proof_url: null,
        updated_at: new Date().toISOString(),
      }).eq("id", invoice.id);

      await supabase.from("invoice_payments").update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      }).eq("id", payment_id);

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
