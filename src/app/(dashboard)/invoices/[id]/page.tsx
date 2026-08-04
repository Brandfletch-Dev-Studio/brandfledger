"use client";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Send, Copy, Trash2, Loader2, ArrowLeft, Mail, MessageCircle, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { BFLogo } from "@/components/bf-logo";
import { generateInvoicePDF } from "@/lib/invoice-pdf";

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
    const res = await fetch("/api/data/invoices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoiceId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    toast({ title: successMsg });
    load();
  }

  async function markAsPaid() {
    setActing("paid");
    try {
      // 1. Update invoice status
      await patch({ status: "paid" }, "Marked as paid");

      // 2. Auto-log a transaction for this payment
      if (business?.id) {
        const items: any[] = invoice.items || [];
        const description = items.length > 0
          ? items.map((it: any) => it.name || it.description || "Item").join(", ")
          : `Invoice ${invoice.invoice_number}`;

        await fetch("/api/data/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_transaction",
            business_id: business.id,
            type: "income",
            client_name: invoice.customer_name || "Client",
            description: `${description} (Invoice ${invoice.invoice_number})`,
            amount: Number(invoice.total),
            cost_amount: 0,
            payment_method: "invoice",
            date: new Date().toISOString().split("T")[0],
          }),
        });
        toast({ title: "Transaction logged", description: `Income of ${formatCurrency(Number(invoice.total), business.currency)} recorded.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
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

  function shareViaWhatsApp() {
    const phone = (invoice.customer_phone || "").replace(/\D/g, "");
    const shareUrl = `${window.location.origin}/invoices/view/${invoiceId}`;
    const currency = business?.currency ?? "MWK";
    const total = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(Number(invoice.total));
    const msg = encodeURIComponent(
      `Hi ${invoice.customer_name || ""}! Here is your invoice ${invoice.invoice_number} from ${business?.name || "us"} for ${total}.\n\nView it here: ${shareUrl}`
    );
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    }
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
  const normItems = items.map((it: any) => ({
    ...it,
    unit_price: Number(it.unit_price ?? it.price ?? 0),
    total: Number(it.total ?? (Number(it.unit_price ?? it.price ?? 0) * Number(it.quantity ?? 1))),
  }));
  const clientName = invoice.customer_name || "—";
  const clientEmail = invoice.customer_email || "";
  const clientPhone = invoice.customer_phone || "";

  async function handleDownloadPDF() {
    if (!invoice || !business) return;
    setActing("pdf");
    toast({ title: "Generating PDF...", description: `Preparing ${invoice.invoice_number} for download` });
    try {
      // Small delay so the toast can render before the save dialog
      await new Promise((r) => setTimeout(r, 300));
      generateInvoicePDF(invoice, {
        name: business.name || "Your Business",
        email: business.email,
        phone: business.phone,
        address: business.address,
        currency: business.currency ?? "MWK",
        logo_url: business.logo_url,
        accent_color: business.invoice_accent_color,
        template: business.invoice_template,
      });
      toast({ title: "PDF downloaded", description: `${invoice.invoice_number}.pdf saved to your device` });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl mx-auto">
      <button onClick={() => router.push("/invoices")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
          <Badge className={`mt-1 text-xs ${status.cls}`}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleDownloadPDF} title="Download PDF" disabled={acting === "pdf"}
            className="h-9 px-4 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-2 text-xs font-semibold transition-colors disabled:opacity-50">
            {acting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {acting === "pdf" ? "Generating..." : "Download PDF"}
          </button>
          <button onClick={copyLink} title="Copy share link"
            className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={shareViaWhatsApp} title="Share via WhatsApp"
            className="h-8 w-8 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors">
            <MessageCircle className="h-4 w-4" />
          </button>
          {invoice.customer_email && invoice.status !== "paid" && (
            <button onClick={sendEmail} disabled={acting === "send"}
              className="h-8 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50">
              {acting === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Send
            </button>
          )}
          {invoice.status !== "paid" && (
            <button onClick={markAsPaid} disabled={!!acting}
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

      <div className="rounded-2xl overflow-hidden border shadow-sm bg-card">
        <div className="text-white px-5 py-4 flex items-center justify-between" style={{ backgroundColor: business?.invoice_accent_color || "#4f46e5" }}>
          <div className="flex items-center gap-2.5">
            <BFLogo size={32} className="rounded-lg" />
            <div>
              {business?.logo_url && (
              <img src={business.logo_url} alt="Logo" className="h-8 w-8 rounded object-contain bg-white/10 mb-1" />
            )}
            <p className="font-bold leading-tight">{business?.name ?? "Your Business"}</p>
              {business?.email && <p className="text-xs text-indigo-200">{business.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-indigo-200 uppercase tracking-wide">Invoice</p>
            <p className="font-bold">{invoice.invoice_number}</p>
          </div>
        </div>

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

        <div className="px-5 py-3 grid grid-cols-2 gap-4 border-b text-sm">
          <div><span className="text-muted-foreground">Issue Date: </span><span className="font-medium">{formatDate(invoice.issue_date)}</span></div>
          <div><span className="text-muted-foreground">Due Date: </span><span className="font-medium">{formatDate(invoice.due_date)}</span></div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Items</div>
          <div className="space-y-2">
            {normItems.map((item: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name || item.description || "Item"}</p>
                  {item.description && item.name && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity ?? 1} × {formatCurrency(item.unit_price, currency)}</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(item.total, currency)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 text-sm border-t pt-4">
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(Number(invoice.discount_amount), currency)}</span>
              </div>
            )}
            {Number(invoice.tax_amount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span>{formatCurrency(Number(invoice.tax_amount), currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Total</span>
              <span>{formatCurrency(Number(invoice.total), currency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
