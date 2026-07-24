"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Send, CheckCircle, Copy, FileText, Download, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";

export default function InvoiceDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [invoiceId]);

  async function loadData() {
    setLoading(true);
    const sb = createClient();
    const { data: biz, error: bizError } = await getDefaultBusiness(sb);
    if (bizError || !biz) { setLoading(false); return; }
    setBusiness(biz);

    const { data: inv, error } = await sb
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("business_id", biz.id)
      .maybeSingle();

    if (inv) {
      setInvoice(inv);
      if (inv.customer_id) {
        const { data: cust } = await sb
          .from("customers")
          .select("*")
          .eq("id", inv.customer_id)
          .maybeSingle();
        setCustomer(cust);
      }
    }
    setLoading(false);
  }

  async function markAsPaid() {
    setActionLoading(true);
    const sb = createClient();
    const { error } = await sb.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invoice marked as paid" });
      loadData();
    }
    setActionLoading(false);
  }

  async function sendInvoice() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Invoice sent!", description: `Email delivered to ${customer?.email ?? "client"}` });
        // Update status to sent
        const sb = createClient();
        await sb.from("invoices").update({ status: "sent" }).eq("id", invoiceId);
        loadData();
      } else {
        toast({ title: "Send failed", description: data.error ?? "Could not send email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Send failed", description: "Network error", variant: "destructive" });
    }
    setActionLoading(false);
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/invoices/view/${invoiceId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share this link with your client" });
    } catch {
      toast({ title: "Share link", description: url });
    }
  }

  const currency = business?.currency ?? "MWK";

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!invoice) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-muted-foreground">Invoice not found.</p>
      <Button variant="outline" onClick={() => router.push("/invoices")}>Back to Invoices</Button>
    </div>
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => router.push("/invoices")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <Badge variant="secondary" className={`capitalize ${statusColors[invoice.status] ?? ""}`}>
          {invoice.status}
        </Badge>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {invoice.status !== "paid" && (
          <Button size="sm" onClick={markAsPaid} disabled={actionLoading}>
            <CheckCircle className="h-4 w-4 mr-1.5" /> Mark as Paid
          </Button>
        )}
        {invoice.status === "draft" && customer?.email && (
          <Button size="sm" variant="outline" onClick={sendInvoice} disabled={actionLoading}>
            <Send className="h-4 w-4 mr-1.5" /> {actionLoading ? "Sending..." : "Email to Client"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={copyShareLink}>
          <Copy className="h-4 w-4 mr-1.5" /> Copy Share Link
        </Button>
        <a href={`/invoices/view/${invoiceId}`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            <ExternalLink className="h-4 w-4 mr-1.5" /> Preview
          </Button>
        </a>
      </div>

      {/* Invoice document */}
      <Card>
        <CardContent className="p-5 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">{business?.name ?? "Invoice"}</h1>
              <p className="text-sm text-muted-foreground mt-1">{business?.email ?? ""}</p>
              <p className="text-sm text-muted-foreground">{business?.phone ?? ""}</p>
              <p className="text-sm text-muted-foreground">{business?.address ?? ""}</p>
            </div>
            <div className="sm:text-right">
              <div className="inline-flex items-center gap-1.5 text-sm font-medium mb-1">
                <FileText className="h-4 w-4" /> Invoice
              </div>
              <p className="text-lg font-bold">{invoice.invoice_number}</p>
              <p className="text-sm text-muted-foreground mt-2">Issued: {formatDate(invoice.issue_date)}</p>
              <p className="text-sm text-muted-foreground">Due: {formatDate(invoice.due_date)}</p>
            </div>
          </div>

          {/* Bill to */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
            <p className="font-medium">{customer?.name ?? "Unknown"}</p>
            {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
            {customer?.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </div>

          {/* Items */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left font-semibold text-muted-foreground p-2">Description</th>
                  <th className="text-center font-semibold text-muted-foreground p-2">Qty</th>
                  <th className="text-right font-semibold text-muted-foreground p-2">Unit Price</th>
                  <th className="text-right font-semibold text-muted-foreground p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items ?? []).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2">
                      <p className="font-medium">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(Number(item.unit_price), currency)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(Number(item.total), currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(Number(invoice.subtotal), currency)}</span>
              </div>
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                  <span className="font-medium">{formatCurrency(Number(invoice.tax_amount), currency)}</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex justify-between">
                <span className="font-semibold">Total Due</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(Number(invoice.total), currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-6 rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
