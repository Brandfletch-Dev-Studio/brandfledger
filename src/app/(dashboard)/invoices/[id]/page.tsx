"use client";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Send, Copy, Trash2, Loader2, ArrowLeft, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { BFLogo } from "@/components/bf-logo";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:   { label: "Draft",   cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  sent:    { label: "Sent",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  paid:    { label: "Paid",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  overdue: { label: "Overdue", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
};

export default function InvoiceDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/invoices");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      const found = (data.invoices || []).find((inv: any) => inv.id === invoiceId);
      if (!found) { router.push("/invoices"); return; }
      setInvoice(found);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router, toast]);

  useEffect(() => { load(); }, [load]);

  async function patch(payload: object, successMsg: string) {
    try {
      const res = await fetch("/api/data/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: successMsg });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function sendEmail() {
    setActing("send");
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast({ title: "Invoice sent!", description: `Email delivered to ${invoice.customer_email || "client"}` });
      await patch({ status: "sent" }, "Marked as sent");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/invoices/view/${invoiceId}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    toast({ title: "Link copied", description: "Share this with your client" });
  }

  async function deleteInvoice() {
    if (!confirm("Delete this invoice?")) return;
    setActing("delete");
    try {
      const res = await fetch(`/api/data/invoices?id=${invoiceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Deleted" });
      router.push("/invoices");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setActing(null);
    }
  }

  if (loading || !invoice) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const currency = business?.currency ?? "MWK";
  const status = STATUS[invoice.status] ?? STATUS.draft;
  const items: any[] = invoice.items || [];

  // Normalise item fields — DB stores as unit_price OR price
  const normItems = items.map((it: any) => ({
    ...it,
    unit_price: Number(it.unit_price ?? it.price ?? 0),
    total: Number(it.total ?? (Number(it.unit_price ?? it.price ?? 0) * Number(it.quantity ?? 1))),
  }));

  const clientName = invoice.customer_name || "—";
  const clientEmail = invoice.customer_email || "";
  const clientPhone = invoice.customer_phone || "";

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Nav */}
      <button onClick={() => router.push("/invoices")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
          <Badge className={`mt-1 text-xs ${status.cls}`}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={copyLink} title="Copy share link"
            className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" />
          </button>
          {invoice.customer_email && invoice.status !== "paid" && (
            <button onClick={sendEmail} disabled={acting === "send"}
              className="h-8 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
              {acting === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Send
            </button>
          )}
          {invoice.status !== "paid" && (
            <button onClick={() => { setActing("paid"); patch({ status: "paid" }, "Marked as paid").finally(() => setActing(null)); }}
              disabled={acting === "paid"}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
              {acting === "paid" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Paid
            </button>
          )}
          <button onClick={deleteInvoice} disabled={!!acting}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── INVOICE CARD ── */}
      <div className="rounded-2xl overflow-hidden border shadow-sm bg-card">

        {/* Brand header */}
        <div className="bg-indigo-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BFLogo size={32} className="rounded-lg" />
            <div>
              <p className="font-bold leading-tight">{business?.name ?? "Your Business"}</p>
              {business?.email && <p className="text-xs text-indigo-200">{business.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-indigo-200 uppercase tracking-wide">Invoice</p>
            <p className="font-bold">{invoice.invoice_number}</p>
          </div>
        </div>

        {/* From / Bill To + Dates */}
        <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">From</p>
            <p className="text-sm font-medium">{business?.name}</p>
            {business?.phone && <p className="text-xs text-muted-foreground">{business.phone}</p>}
            {business?.address && <p className="text-xs text-muted-foreground">{business.address}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-sm font-medium">{clientName}</p>
            {clientEmail && <p className="text-xs text-muted-foreground">{clientEmail}</p>}
            {clientPhone && <p className="text-xs text-muted-foreground">{clientPhone}</p>}
          </div>
        </div>

        {/* Dates */}
        <div className="px-5 py-3 grid grid-cols-2 gap-4 border-b bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Issue Date</p>
            <p className="text-sm font-medium mt-0.5">{formatDate(invoice.issue_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Due Date</p>
            <p className="text-sm font-medium mt-0.5">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left pb-2 font-semibold">Item</th>
                <th className="text-center pb-2 font-semibold w-10">Qty</th>
                <th className="text-right pb-2 font-semibold w-24">Price</th>
                <th className="text-right pb-2 font-semibold w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {normItems.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">No items</td></tr>
              ) : normItems.map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2.5 pr-2">
                    <p className="font-medium">{item.name || item.description || "Item"}</p>
                  </td>
                  <td className="py-2.5 text-center text-muted-foreground">{item.quantity}</td>
                  <td className="py-2.5 text-right">{formatCurrency(item.unit_price, currency)}</td>
                  <td className="py-2.5 text-right font-semibold">{formatCurrency(item.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-t bg-muted/20 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(Number(invoice.subtotal), currency)}</span>
          </div>
          {Number(invoice.tax_rate) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
              <span>{formatCurrency(Number(invoice.tax_amount), currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1.5 border-t">
            <span>Total</span>
            <span className="text-indigo-600">{formatCurrency(Number(invoice.total), currency)}</span>
          </div>
        </div>

        {/* Notes + footer */}
        {invoice.notes && (
          <div className="px-5 py-3 border-t">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}
        <div className="px-5 py-3 border-t bg-indigo-50/50 dark:bg-indigo-950/20 text-center">
          <p className="text-xs text-muted-foreground">Powered by <span className="font-semibold text-indigo-600">Brandfledger</span></p>
        </div>
      </div>

      {/* No email warning */}
      {!invoice.customer_email && invoice.status !== "paid" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          ⚠ No email on file for this client — add one in Clients to enable email sending.
        </p>
      )}
    </div>
  );
}
