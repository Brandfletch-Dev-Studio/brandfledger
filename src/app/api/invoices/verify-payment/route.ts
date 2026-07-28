import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getCredential(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
    if (!data?.value?.encoded) return null;
    return Buffer.from(data.value.encoded, "base64").toString("utf-8");
  } catch { return null; }
}

/**
 * GET /api/invoices/verify-payment?charge_id=xxx
 * Public endpoint — polls Paychangu to check if an invoice payment has completed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chargeId = searchParams.get("charge_id");
    if (!chargeId) return NextResponse.json({ error: "charge_id required" }, { status: 400 });

    // Check our DB first
    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("paychangu_charge_id", chargeId)
      .maybeSingle();
    if (payErr) throw payErr;

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Already resolved
    if (payment.status === "completed") {
      return NextResponse.json({ status: "success", chargeId });
    }
    if (payment.status === "failed") {
      return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
    }

    // Auto-fail if older than 15 minutes
    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) {
      await supabase.from("invoice_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return NextResponse.json({ status: "failed", chargeId, reason: "timeout" });
    }

    // Fetch the invoice for business context
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, business_id, invoice_number, total, amount_paid, status, customer_id, items, balance_due")
      .eq("id", payment.invoice_id)
      .maybeSingle();
    if (!invoice) return NextResponse.json({ status: "failed", chargeId, reason: "invoice_deleted" });

    // Poll Paychangu
    const PAYCHANGU_SECRET =
      (await getCredential("paychangu_secret_key")) ||
      process.env.PAYCHANGU_SECRET_KEY || "";

    if (!PAYCHANGU_SECRET) {
      return NextResponse.json({ status: "pending", chargeId });
    }

    try {
      const verifyRes = await fetch(
        `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
        {
          headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (verifyRes.ok) {
        const result = await verifyRes.json();
        const paychanguStatus = result?.data?.status || result?.status || "pending";
        const returnedRef = result?.data?.charge_id || result?.data?.tx_ref || "";

        if (returnedRef && returnedRef !== chargeId) {
          // Cross-invoice guard — ref doesn't match
          return NextResponse.json({ status: "pending", chargeId });
        }

        if (paychanguStatus === "successful" || paychanguStatus === "success") {
          // Payment confirmed — update invoice
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
          }).eq("id", payment.id);

          // Create income transaction (same as mark-as-paid flow)
          const invItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
          const totalCost = invItems.reduce((sum: number, item: any) => {
            const qty = parseFloat(item.quantity) || 1;
            const itemCost = parseFloat(item.cost) || 0;
            return sum + qty * itemCost;
          }, 0);
          const invoiceProfit = Number(payment.amount) - totalCost;

          // Get customer name
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
            description: `Payment for ${invoice.invoice_number}`,
            amount: Number(payment.amount),
            cost_amount: totalCost,
            profit: invoiceProfit,
            payment_method: "paychangu",
            date: new Date().toISOString().split("T")[0],
            invoice_id: invoice.id,
          });

          return NextResponse.json({
            status: "success",
            chargeId,
            invoice_number: invoice.invoice_number,
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            invoice_status: newStatus,
          });
        }

        if (paychanguStatus === "failed" || paychanguStatus === "cancelled") {
          await supabase.from("invoice_payments").update({
            status: "failed",
            updated_at: new Date().toISOString(),
          }).eq("id", payment.id);

          return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
        }
      }
    } catch {
      // Verify endpoint failed — try fallback
      try {
        const fallbackRes = await fetch(
          `https://api.paychangu.com/verify-payment/${encodeURIComponent(chargeId)}`,
          {
            headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (fallbackRes.ok) {
          const fbResult = await fallbackRes.json();
          const fbStatus = fbResult?.data?.status || fbResult?.status || "pending";
          if (fbStatus === "successful" || fbStatus === "success") {
            // Same success flow as above
            const newAmountPaid = Number(invoice.amount_paid || 0) + Number(payment.amount);
            const newBalanceDue = Number(invoice.total) - newAmountPaid;
            const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

            await supabase.from("invoices").update({
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              status: newStatus,
              updated_at: new Date().toISOString(),
            }).eq("id", invoice.id);

            await supabase.from("invoice_payments").update({
              status: "completed",
              updated_at: new Date().toISOString(),
            }).eq("id", payment.id);

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
              description: `Payment for ${invoice.invoice_number}`,
              amount: Number(payment.amount),
              cost_amount: totalCost,
              profit: Number(payment.amount) - totalCost,
              payment_method: "paychangu",
              date: new Date().toISOString().split("T")[0],
              invoice_id: invoice.id,
            });

            return NextResponse.json({
              status: "success",
              chargeId,
              invoice_number: invoice.invoice_number,
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              invoice_status: newStatus,
            });
          }
          if (fbStatus === "failed" || fbStatus === "cancelled") {
            await supabase.from("invoice_payments").update({
              status: "failed",
              updated_at: new Date().toISOString(),
            }).eq("id", payment.id);
            return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
          }
        }
      } catch {
        // Both endpoints unreachable — stay pending
      }
    }

    return NextResponse.json({ status: "pending", chargeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
