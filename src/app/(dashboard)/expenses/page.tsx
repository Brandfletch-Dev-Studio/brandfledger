"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Receipt, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["Office", "Rent", "Utilities", "Marketing", "Travel", "Equipment", "Software", "Salaries", "Contractors", "Other"];

const BLANK_FORM = { description: "", category: "Other", amount: "", date: new Date().toISOString().split("T")[0], vendor: "", notes: "" };

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const sb = createClient();
    const { data: biz, error: bizError } = await getDefaultBusiness(sb);
    if (bizError) {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);
    const { data, error } = await sb.from("expenses").select("*").eq("business_id", biz.id).order("date", { ascending: false });
    if (error) toast({ title: "Couldn't load expenses", description: error.message, variant: "destructive" });
    setExpenses(data ?? []);
    setPageLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
    setOpen(true);
  }

  function openEdit(e: any) {
    setEditing(e);
    setForm({ description: e.description, category: e.category, amount: String(e.amount), date: e.date, vendor: e.vendor ?? "", notes: e.notes ?? "" });
    setOpen(true);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setEditing(null);
      setForm({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
    }
  }

  async function handleSave() {
    if (!form.description || !form.amount || !business) return;
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid amount greater than 0.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const sb = createClient();
    const data = { description: form.description, category: form.category, amount: parsedAmount, date: form.date, vendor: form.vendor, notes: form.notes };
    if (editing) {
      await sb.from("expenses").update(data).eq("id", editing.id);
      toast({ title: "Expense updated" });
    } else {
      await sb.from("expenses").insert({ ...data, business_id: business.id });
      toast({ title: "Expense logged" });
    }
    setOpen(false); setLoading(false); loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    const sb = createClient();
    await sb.from("expenses").delete().eq("id", id);
    toast({ title: "Expense deleted" }); loadData();
  }

  const filtered = expenses.filter(e =>
    (catFilter === "all" || e.category === catFilter) &&
    (e.description.toLowerCase().includes(search.toLowerCase()) || e.vendor?.toLowerCase().includes(search.toLowerCase()))
  );

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  if (pageLoading) return (
    <div>
      <Header title="Expenses" description="Track your business expenses" />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Expenses" description="Track your business expenses"
        actions={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild><Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Log Expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Log Expense"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Office supplies..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Supplier name" /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" /></div>
                <Button onClick={handleSave} disabled={loading || !form.description || !form.amount} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Expense" : "Log Expense"}
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
            <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtered.length > 0 && <div className="text-sm text-muted-foreground ml-auto">Total: <strong>{formatCurrency(total, business?.currency)}</strong></div>}
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search || catFilter !== "all" ? "No expenses match your filters." : "No expenses yet. Log your first expense!"}</p>
          </CardContent></Card>
        ) : (
          <Card>
            <div className="divide-y">
              {filtered.map(e => (
                <div key={e.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{e.category}{e.vendor ? ` · ${e.vendor}` : ""} · {formatDate(e.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-red-600">-{formatCurrency(e.amount, business?.currency)}</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
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
