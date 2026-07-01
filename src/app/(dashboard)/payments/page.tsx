"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CreditCard, Trash2, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const METHODS = ["Cash", "Bank Transfer", "Mobile Money", "Card", "Cheque", "Other"];

const BLANK_FORM = { invoice_id: "", amount: "", date: new Date().toISOString().split("T")[0], method: "Cash", reference: "", notes: "" };

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setPageLoading(false); return; }
    const { data: biz, error: bizError } = await sb.from("businesses").select("*").eq("owner_id", user.id).single();
    if (bizError && bizError.code !== "PGRST116") {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);
    const [{ data: pmts, error: pmtsError }, { data: invs, error: invsError }] = await Promise.all([
      sb.from("payments").select("*, invoices(invoice_number, total)").eq("business_id", biz.id).order("date", { ascending: false }),
      sb.from("invoices").select("id, invoice_number, total, status").eq("business_id", biz.id).in("status", ["sent", "overdue"]).order("created_at", { ascending: false }),
    ]);
    if (pmtsError || invsError) {
      toast({ title: "Couldn't load some data", description: (pmtsError ?? invsError)?.message, variant: "destructive" });
    }
    setPayments(pmts ?? []);
    setInvoices(invs ?? []);
    setPageLoading(false);
  }

  // Auto-fill amount when invoice selected
  function handleInvoiceSelect(invoiceId: string) {
    const inv = invoices.find(i => i.id === invoiceId);
    setForm(p => ({ ...p, invoice_id: invoiceId, amount: inv ? String(inv.total) : p.amount }));
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
  }

  async function handleSave() {
    if (!form.amount || !business) return;
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.from("payments").insert({
      business_id: business.id,
      invoice_id: form.invoice_id || null,
      amount: parsedAmount,
      date: form.date,
      method: form.method,
      reference: form.reference,
      notes: form.notes,
    });
    if (error) {
      toast({ title: "Error recording payment", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Only mark invoice paid if payment covers the full amount
    if (form.invoice_id) {
      const inv = invoices.find(i => i.id === form.invoice_id);
      if (inv && parsedAmount >= inv.total) {
        await sb.from("invoices").update({ status: "paid" }).eq("id", form.invoice_id);
      }
    }
    toast({ title: "Payment recorded" });
    setOpen(false); setLoading(false); loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment record?")) return;
    const sb = createClient();
    await sb.from("payments").delete().eq("id", id);
    toast({ title: "Payment deleted" }); loadData();
  }

  const filtered = payments.filter(p =>
    (p as any).invoices?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.method?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((s: number, p: any) => s + p.amount, 0);

  if (pageLoading) return (
    <div>
      <Header title="Payments" description="Record and track payments received" />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Payments" description="Record and track payments received"
        actions={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Record Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Invoice (optional)</Label>
                  <Select value={form.invoice_id} onValueChange={handleInvoiceSelect}>
                    <SelectTrigger><SelectValue placeholder="Link to invoice..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No invoice</SelectItem>
                      {invoices.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {formatCurrency(inv.total, business?.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={form.method} onValueChange={v => setForm(p => ({ ...p, method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference</Label>
                    <Input placeholder="Txn ID, cheque no..." value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Optional notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.amount} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search payments..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.length > 0 && <div className="text-sm text-muted-foreground ml-auto">Total: <strong>{formatCurrency(total, business?.currency)}</strong></div>}
        </div>
        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <CreditCard className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search ? "No payments match your search." : "No payments recorded yet."}</p>
          </CardContent></Card>
        ) : (
          <Card>
            <div className="divide-y">
              {filtered.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.invoices?.invoice_number ?? "Unlinked payment"}</p>
                      <p className="text-xs text-muted-foreground">{p.method}{p.reference ? ` · ${p.reference}` : ""} · {formatDate(p.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-green-600">+{formatCurrency(p.amount, business?.currency)}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
