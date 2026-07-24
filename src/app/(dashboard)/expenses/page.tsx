"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Receipt, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BLANK_FORM = { description: "", amount: "", date: new Date().toISOString().split("T")[0], vendor: "", payment_method: "cash", notes: "" };

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setPageLoading(true);
    try {
      const res = await fetch("/api/data/transactions");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      const expenseTx = (data.transactions || []).filter((t: any) => t.type === "expense");
      setExpenses(expenseTx);
    } catch (err: any) {
      toast({ title: "Couldn't load expenses", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
    setOpen(true);
  }

  function openEdit(e: any) {
    setEditing(e);
    setForm({
      description: e.description || "",
      amount: String(e.amount),
      date: e.date ? (e.date instanceof Date ? e.date : new Date(e.date)).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      vendor: e.vendor_name || "",
      payment_method: e.payment_method || "cash",
      notes: "",
    });
    setOpen(true);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setEditing(null); setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] }); }
  }

  async function handleSave() {
    if (!form.description || !form.amount) return;
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        // Update existing transaction
        const res = await fetch("/api/data/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_transaction",
            business_id: business?.id,
            id: editing.id,
            type: "expense",
            description: form.description,
            amount: parsedAmount,
            date: form.date,
            vendor_name: form.vendor,
            payment_method: form.payment_method,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        toast({ title: "Expense updated" });
      } else {
        // Create new expense transaction
        const res = await fetch("/api/data/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_transaction",
            business_id: business?.id,
            type: "expense",
            description: form.description,
            amount: parsedAmount,
            date: form.date,
            vendor_name: form.vendor,
            payment_method: form.payment_method,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save");
        toast({ title: "Expense logged" });
      }
      setOpen(false);
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    try {
      const res = await fetch("/api/data/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_transaction", business_id: business?.id, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "Expense deleted" });
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filtered = expenses.filter(e =>
    e.description?.toLowerCase().includes(search.toLowerCase()) ||
    e.vendor_name?.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const currency = business?.currency ?? "MWK";

  if (pageLoading) return (
    <div>
      <Header title="Expenses" description="Track your business expenses" icon={Receipt} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Expenses" description="Track your business expenses"
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild><Button onClick={openAdd} size="sm"><Plus className="mr-1.5 h-4 w-4" />Log Expense</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Log Expense"}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Office supplies..." /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Amount *</Label>
                      <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Supplier name" /></div>
                  <div className="space-y-2"><Label>Payment Method</Label><Input value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} placeholder="cash, bank, mobile" /></div>
                  <Button onClick={handleSave} disabled={loading || !form.description || !form.amount} className="w-full">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Expense" : "Log Expense"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="p-3 sm:p-6 space-y-4">
        {expenses.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Expenses</p>
                <p className="text-xl font-bold text-rose-600 mt-0.5">{formatCurrency(total, currency)}</p>
              </div>
              <Receipt className="h-8 w-8 text-muted-foreground/30" />
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search ? "No expenses match your search." : "No expenses yet. Log your first expense!"}</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map(e => (
              <Card key={e.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.vendor_name ? `${e.vendor_name} · ` : ""}{formatDate(e.date)}
                        {e.payment_method ? ` · ${e.payment_method}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold text-rose-600">-{formatCurrency(Number(e.amount), currency)}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
