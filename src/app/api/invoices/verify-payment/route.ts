import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getBusinessPaychanguSecret(businessId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("businesses").select("paychangu_secret_key").eq("id", businessId).maybeSingle();
    return data?.paychangu_secret_key || null;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chargeId = searchParams.get("charge_id");
    if (!chargeId) return NextResponse.json({ error: "charge_id required" }, { status: 400 });

    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments").select("*").eq("paychangu_charge_id", chargeId).maybeSingle();
    if (payErr) throw payErr;
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (payment.status === "completed") return NextResponse.json({ status: "success", chargeId });
    if (payment.status === "failed") return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });

    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) {
      await supabase.from("invoice_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
      return NextResponse.json({ status: "failed", chargeId, reason: "timeout" });
    }

    const { data: invoice } = await supabase
      .from("invoices").select("id, business_id, invoice_number, total, amount_paid, status, customer_id, items, balance_due")
      .eq("id", payment.invoice_id).maybeSingle();
    if (!invoice) return NextResponse.json({ status: "failed", chargeId, reason: "invoice_deleted" });

    const PAYCHANGU_SECRET = await getBusinessPaychanguSecret(invoice.business_id);
    if (!PAYCHANGU_SECRET) return NextResponse.json({ status: "pending", chargeId });

    // Process a successful payment — update invoice, mark payment, create income transaction
    const processSuccess = async () => {
      const newAmountPaid = Number(invoice.amount_paid || 0) + Number(payment.amount);
      const newBalanceDue = Number(invoice.total) - newAmountPaid;
      const newStatus = newBalanceDue <= 0 ? "paid" : "partial";

      await supabase.from("invoices").update({
        amount_paid: newAmountPaid, balance_due: newBalanceDue, status: newStatus, updated_at: new Date().toISOString(),
      }).eq("id", invoice.id);

      await supabase.from("invoice_payments").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", payment.id);

      const invItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
      const totalCost = invItems.reduce((sum: number, item: any) => {
        const qty = parseFloat(item.quantity) || 1;
        const itemCost = parseFloat(item.cost) || 0;
        return sum + qty * itemCost;
      }, 0);

      let clientName: string | null = null;
      if (invoice.customer_id) {
        const { data: cust } = await supabase.from("customers").select("name").eq("id", invoice.customer_id).maybeSingle();
        clientName = cust?.name || null;
      }
      if (!clientName) clientName = `Invoice ${invoice.invoice_number}`;

      await supabase.from("transactions").insert({
        business_id: invoice.business_id, type: "income", client_name: clientName,
        description: `Payment for ${invoice.invoice_number}`, amount: Number(payment.amount),
        cost_amount: totalCost, profit: Number(payment.amount) - totalCost,
        payment_method: "paychangu", date: new Date().toISOString().split("T")[0], invoice_id: invoice.id,
      });

      return NextResponse.json({ status: "success", chargeId, invoice_number: invoice.invoice_number, amount_paid: newAmountPaid, balance_due: newBalanceDue, invoice_status: newStatus });
    };

    try {
      const verifyRes = await fetch(`https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` }, signal: AbortSignal.timeout(8000),
      });
      if (verifyRes.ok) {
        const result = await verifyRes.json();
        const paychanguStatus = result?.data?.status || result?.status || "pending";
        const returnedRef = result?.data?.charge_id || result?.data?.tx_ref || "";
        if (returnedRef && returnedRef !== chargeId) return NextResponse.json({ status: "pending", chargeId });
        if (paychanguStatus === "successful" || paychanguStatus === "success") return await processSuccess();
        if (paychanguStatus === "failed" || paychanguStatus === "cancelled") {
          await supabase.from("invoice_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
          return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
        }
      }
    } catch {
      try {
        const fallbackRes = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(chargeId)}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${PAYCHANGU_SECRET}` }, signal: AbortSignal.timeout(8000),
        });
        if (fallbackRes.ok) {
          const fbResult = await fallbackRes.json();
          const fbStatus = fbResult?.data?.status || fbResult?.status || "pending";
          if (fbStatus === "successful" || fbStatus === "success") return await processSuccess();
          if (fbStatus === "failed" || fbStatus === "cancelled") {
            await supabase.from("invoice_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
            return NextResponse.json({ status: "failed", chargeId, reason: "payment_failed" });
          }
        }
      } catch {}
    }

    return NextResponse.json({ status: "pending", chargeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, status: "pending" }, { status: 500 });
  }
}
