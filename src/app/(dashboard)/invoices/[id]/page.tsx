"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle, Send, Copy, Trash2, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  overdue: { label: "Overdue", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
};

export default function InvoiceDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/invoices");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      const found = (data.invoices || []).find((inv: any) => inv.id === invoiceId);
      if (!found) {
        toast({ title: "Invoice not found", variant: "destructive" });
        router.push("/invoices");
        return;
      }
      setInvoice(found);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, router, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function markAsPaid() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/data/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast({ title: "Marked as paid" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  async function markAsSent() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/data/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, status: "sent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast({ title: "Invoice marked as sent" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/invoices/view/${invoiceId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share this link with your client" });
    } catch {
      toast({ title: "Link", description: url });
    }
  }

  async function deleteInvoice() {
    if (!confirm("Delete this invoice?")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/data/invoices?id=${invoiceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "Invoice deleted" });
      router.push("/invoices");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !invoice) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const currency = business?.currency ?? "MWK";
  const status = statusConfig[invoice.status] ?? statusConfig.draft;
  const items = invoice.items || [];

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-3xl">
      <button onClick={() => router.push("/invoices")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
          <Badge variant="secondary" className={`mt-1 text-xs ${status.className}`}>{status.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={copyShareLink}><Copy className="h-4 w-4" /></Button>
          {invoice.status !== "paid" && invoice.status !== "sent" && (
            <Button size="sm" variant="outline" disabled={actionLoading} onClick={markAsSent}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Mark Sent
            </Button>
          )}
          {invoice.status !== "paid" && (
            <Button size="sm" disabled={actionLoading} onClick={markAsPaid}>
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
              Mark Paid
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500" onClick={deleteInvoice} disabled={actionLoading}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Invoice details */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* From / To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">From</p>
              <p className="font-medium">{business?.name}</p>
              {business?.email && <p className="text-sm text-muted-foreground">{business.email}</p>}
              {business?.phone && <p className="text-sm text-muted-foreground">{business.phone}</p>}
              {business?.address && <p className="text-sm text-muted-foreground">{business.address}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Bill To</p>
              <p className="font-medium">{invoice.customer_name || "Unknown"}</p>
              {invoice.customer_id && <p className="text-sm text-muted-foreground">ID: {invoice.customer_id}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Issue Date</p>
              <p className="text-sm">{formatDate(invoice.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Due Date</p>
              <p className="text-sm">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</p>
            </div>
          </div>

          {/* Items */}
          <div className="pt-3 border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-2 font-medium">Item</th>
                  <th className="text-right pb-2 font-medium">Qty</th>
                  <th className="text-right pb-2 font-medium">Price</th>
                  <th className="text-right pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">No items</td></tr>
                ) : (
                  items.map((item: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5">{item.description || "Item"}</td>
                      <td className="py-2.5 text-right">{item.quantity}</td>
                      <td className="py-2.5 text-right">{formatCurrency(Number(item.price), currency)}</td>
                      <td className="py-2.5 text-right font-medium">{formatCurrency(Number(item.total), currency)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-3 border-t space-y-1.5">
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
              <span>{formatCurrency(Number(invoice.total), currency)}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
