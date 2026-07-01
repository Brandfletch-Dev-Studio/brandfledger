"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Trash2, Printer, Mail, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, calculateInvoiceTotals } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Customer, Product, Business, InvoiceItem } from "@/types";

const statuses = ["draft", "sent", "paid", "overdue"] as const;

const BLANK_FORM = {
  customer_id: "",
  issue_date: new Date().toISOString().split("T")[0],
  due_date: "",
  notes: "",
  tax_rate: "0",
  items: [{ name: "", description: "", quantity: 1, unit_price: 0, total: 0 }] as InvoiceItem[],
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailInvoice, setEmailInvoice] = useState<Invoice | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPageLoading(false); return; }
    const { data: biz, error: bizError } = await supabase.from("businesses").select("*").eq("owner_id", user.id).single();
    if (bizError && bizError.code !== "PGRST116") {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);
    const [{ data: invs, error: invError }, { data: custs, error: custError }, { data: prods, error: prodError }] = await Promise.all([
      supabase.from("invoices").select("*, customers(name, email)").eq("business_id", biz.id).order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("business_id", biz.id).order("name"),
      supabase.from("products").select("*").eq("business_id", biz.id).order("name"),
    ]);
    if (invError || custError || prodError) {
      toast({ title: "Couldn't load some data", description: (invError ?? custError ?? prodError)?.message, variant: "destructive" });
    }
    setInvoices(invs ?? []);
    setCustomers(custs ?? []);
    setProducts(prods ?? []);
    setPageLoading(false);
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setForm(prev => {
      const items = [...prev.items];
      const item = { ...items[idx], [field]: value } as InvoiceItem;
      item.total = item.quantity * item.unit_price;
      items[idx] = item;
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, { name: "", description: "", quantity: 1, unit_price: 0, total: 0 }] }));
  }

  function removeItem(idx: number) {
    if (form.items.length === 1) return; // keep at least one item
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  function applyProduct(idx: number, productId: string) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], name: prod.name, description: prod.description ?? "", unit_price: prod.price, total: items[idx].quantity * prod.price };
      return { ...prev, items };
    });
  }

  const { subtotal, taxAmount, total } = calculateInvoiceTotals(form.items, parseFloat(form.tax_rate) || 0);

  async function handleSave() {
    if (!form.customer_id || form.items.length === 0 || !business) return;
    const hasInvalidItem = form.items.some(i => !i.name || i.unit_price <= 0);
    if (hasInvalidItem) { toast({ title: "Fix line items", description: "Each item needs a name and a price greater than 0.", variant: "destructive" }); return; }
    setLoading(true);
    const supabase = createClient();

    // Use max invoice number to avoid race condition from COUNT
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastInvoice?.invoice_number) {
      const parts = lastInvoice.invoice_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    const invoice_number = `${business.invoice_prefix}-${String(nextNum).padStart(5, "0")}`;

    const { error } = await supabase.from("invoices").insert({
      business_id: business.id,
      customer_id: form.customer_id,
      invoice_number,
      status: "draft",
      issue_date: form.issue_date,
      due_date: form.due_date || form.issue_date,
      items: form.items,
      subtotal,
      tax_rate: parseFloat(form.tax_rate) || 0,
      tax_amount: taxAmount,
      total,
      notes: form.notes,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Invoice ${invoice_number} created` });
      setOpen(false);
      setForm({ ...BLANK_FORM, issue_date: new Date().toISOString().split("T")[0] });
    }
    setLoading(false);
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from("invoices").update({ status }).eq("id", id);
    toast({ title: `Status updated to ${status}` });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const supabase = createClient();
    await supabase.from("invoices").delete().eq("id", id);
    toast({ title: "Invoice deleted" });
    loadData();
  }

  function openEmailDialog(inv: Invoice) {
    setEmailInvoice(inv);
    setEmailOpen(true);
  }

  async function handleSendEmail() {
    if (!emailInvoice || !business) return;
    const customer = (emailInvoice as any).customers;
    if (!customer?.email) {
      toast({ title: "No email address", description: "This customer has no email on file.", variant: "destructive" });
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: emailInvoice.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed to send");
      if (emailInvoice.status === "draft") {
        const supabase = createClient();
        await supabase.from("invoices").update({ status: "sent" }).eq("id", emailInvoice.id);
      }
      toast({ title: "Invoice emailed!", description: `Sent to ${customer.email}` });
      setEmailOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Error sending email", description: err.message, variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  }

  const filtered = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv as any).customers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border",
    sent: "bg-blue-100 text-blue-700 border-blue-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
  };

  if (pageLoading) return (
    <div>
      <Header title="Invoices" description="Create and manage invoices" />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Invoices" description="Create and manage invoices" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...BLANK_FORM, issue_date: new Date().toISOString().split("T")[0] }); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select value={form.customer_id} onValueChange={v => setForm(p => ({ ...p, customer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" min="0" max="100" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input type="date" value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                    {!form.due_date && <p className="text-xs text-muted-foreground">Defaults to issue date if left blank</p>}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Line Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
                  </div>
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start border rounded-lg p-2">
                        <div className="col-span-4 space-y-1">
                          <Select onValueChange={v => applyProduct(idx, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick product" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input className="h-8 text-xs" placeholder="Item name *" value={item.name} onChange={e => updateItem(idx, "name", e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          <Input className="h-8 text-xs" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 1)} />
                        </div>
                        <div className="col-span-3">
                          <Input className="h-8 text-xs" type="number" min="0" step="0.01" placeholder="Unit price" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="col-span-2 flex items-center h-8">
                          <span className="text-xs font-medium">{formatCurrency(item.total, business?.currency)}</span>
                        </div>
                        <div className="col-span-1 flex items-center h-8">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)} disabled={form.items.length === 1}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-6 text-sm border-t pt-3">
                  <span className="text-muted-foreground">Subtotal: <strong>{formatCurrency(subtotal, business?.currency)}</strong></span>
                  {parseFloat(form.tax_rate) > 0 && <span className="text-muted-foreground">Tax: <strong>{formatCurrency(taxAmount, business?.currency)}</strong></span>}
                  <span className="font-semibold">Total: {formatCurrency(total, business?.currency)}</span>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Payment instructions, thank you note..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.customer_id} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Invoice"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">{search ? "No invoices match your search." : "No invoices yet. Create your first one!"}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y">
              {filtered.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{(inv as any).customers?.name ?? "—"} · {formatDate(inv.issue_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(inv.total, business?.currency)}</span>
                    <Select value={inv.status} onValueChange={v => updateStatus(inv.id, v)}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => <SelectItem key={s} value={s} className="text-xs">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEmailDialog(inv)} title="Email invoice">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(inv.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Email Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Send <strong>{emailInvoice?.invoice_number}</strong> to <strong>{(emailInvoice as any)?.customers?.email ?? "customer"}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">A professionally formatted email will be delivered with the invoice details.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSendEmail} disabled={emailLoading}>
                {emailLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Mail className="mr-2 h-4 w-4" />Send Email</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
