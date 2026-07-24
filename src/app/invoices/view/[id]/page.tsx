import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText, CheckCircle, AlertCircle, Send } from "lucide-react";

export const dynamic = "force-dynamic";

interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export default async function PublicInvoiceView({ params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: invoice } = await sb
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto" />
          <h1 className="text-xl font-semibold">Invoice not found</h1>
          <p className="text-muted-foreground text-sm">This invoice may have been deleted or the link is invalid.</p>
        </div>
      </div>
    );
  }

  // Fetch customer and business
  const [custRes, bizRes] = await Promise.all([
    sb.from("customers").select("*").eq("id", invoice.customer_id).maybeSingle(),
    sb.from("businesses").select("*").eq("id", invoice.business_id).maybeSingle(),
  ]);

  const customer = custRes.data;
  const business = bizRes.data;
  const currency = business?.currency ?? "MWK";
  const items = (invoice.items ?? []) as InvoiceItem[];

  const statusConfig: Record<string, { label: string; icon: string; color: string }> = {
    draft: { label: "Draft", icon: "FileText", color: "bg-muted text-muted-foreground" },
    sent: { label: "Sent", icon: "Send", color: "bg-blue-100 text-blue-700" },
    paid: { label: "Paid", icon: "CheckCircle", color: "bg-emerald-100 text-emerald-700" },
    overdue: { label: "Overdue", icon: "AlertCircle", color: "bg-rose-100 text-rose-700" },
  };
  const status = statusConfig[invoice.status] ?? statusConfig.draft;

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <div className="max-w-2xl mx-auto bg-card rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{business?.name ?? "Invoice"}</h1>
              <p className="opacity-80 text-sm mt-1">{business?.email ?? ""}</p>
              {business?.phone && <p className="opacity-80 text-sm">{business.phone}</p>}
              {business?.address && <p className="opacity-80 text-sm">{business.address}</p>}
            </div>
            <div className="text-right">
              <p className="opacity-70 text-xs uppercase tracking-wider">Invoice</p>
              <p className="text-lg font-bold mt-1">{invoice.invoice_number}</p>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="px-6 sm:px-8 pt-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Bill to + dates */}
        <div className="px-6 sm:px-8 py-4 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
            <p className="font-medium">{customer?.name ?? "Unknown"}</p>
            {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            {customer?.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
            {customer?.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </div>
          <div className="sm:text-right space-y-1">
            <p className="text-sm"><span className="text-muted-foreground">Issued: </span><span className="font-medium">{formatDate(invoice.issue_date)}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Due: </span><span className="font-medium">{formatDate(invoice.due_date)}</span></p>
          </div>
        </div>

        {/* Items table */}
        <div className="px-6 sm:px-8 pb-4">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left font-semibold text-muted-foreground p-2">Description</th>
                <th className="text-center font-semibold text-muted-foreground p-2 w-12">Qty</th>
                <th className="text-right font-semibold text-muted-foreground p-2 w-24">Price</th>
                <th className="text-right font-semibold text-muted-foreground p-2 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
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
        <div className="px-6 sm:px-8 pb-4 flex justify-end">
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
          <div className="px-6 sm:px-8 pb-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 sm:px-8 py-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            {business?.name ?? ""}{business?.email ? ` · ${business.email}` : ""}{business?.phone ? ` · ${business.phone}` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by <span className="font-semibold">Brandfledger</span>
          </p>
        </div>
      </div>
    </div>
  );
}
