"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, TrendingUp, TrendingDown, Loader2, Trash2, RefreshCw, Pencil, X, Check, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCachedFetch, clearCache } from "@/hooks/use-cached-fetch";
import type { Transaction, Product } from "@/types";
import { PAYMENT_METHODS } from "@/types";
import { SearchableSelect } from "@/components/ui/searchable-select";

const BLANK_LINE = { product_id: "", description: "", qty: "1", unit_price: "", unit_cost: "" };
const BLANK_INCOME = { client_name: "", payment_method: "cash", date: new Date().toISOString().split("T")[0] };
const BLANK_EXPENSE = { description: "", amount: "", vendor_name: "", payment_method: "cash", date: new Date().toISOString().split("T")[0] };

/** Inline edit row state */
interface EditState {
  id: string;
  type: "income" | "expense";
  client_name: string;
  vendor_name: string;
  description: string;
  amount: string;
  cost_amount: string;
  payment_method: string;
  date: string;
}


function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  const end: Date = now;
  switch (period) {
    case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0); break;
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    }
    case 'this_quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
    case 'all_time': start = new Date(2000, 0, 1); break;
    default: start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast); toastRef.current = toast;

  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [incomeForm, setIncomeForm] = useState(BLANK_INCOME);
  const [lineItems, setLineItems] = useState([{ ...BLANK_LINE }]);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);

  // Edit state — null = no transaction is being edited
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [period, setPeriod] = useState<string>("this_month");
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const bizId = typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null;

  const { data: pageData, loading: pageLoading, refreshing, refetch } = useCachedFetch({
    key: `transactions_v2:${bizId ?? "default"}`,
    fetcher: async () => {
      const url = bizId ? `/api/data/transactions?business_id=${bizId}` : "/api/data/transactions";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load data");
      const d = await res.json();
      setBusiness(d.business);
      return {
        transactions: (d.transactions ?? []) as Transaction[],
        products: (d.products ?? []) as Product[],
      };
    },
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const refreshCustomers = useCallback(() => {
    const url = bizId ? `/api/data/customers?business_id=${bizId}` : "/api/data/customers";
    fetch(url).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.customers) setCustomers(d.customers);
    }).catch(() => {});
  }, [bizId]);
  useEffect(() => { refreshCustomers(); }, [refreshCustomers]);

  const transactions = pageData?.transactions ?? [];
  const products = pageData?.products ?? [];

  const lineTotals = useMemo(() => {
    let totalAmount = 0, totalCost = 0;
    for (const li of lineItems) {
      const qty = parseFloat(li.qty) || 1;
      const price = parseFloat(li.unit_price) || 0;
      const cost = parseFloat(li.unit_cost) || 0;
      totalAmount += qty * price;
      totalCost += qty * cost;
    }
    return { totalAmount, totalCost, profit: totalAmount - totalCost };
  }, [lineItems]);

  function onLineProductChange(index: number, productId: string) {
    const product = products.find((p: Product) => p.id === productId);
    setLineItems(prev => prev.map((li, i) => i !== index ? li : {
      ...li,
      product_id: productId,
      unit_price: product ? String(product.price) : li.unit_price,
      unit_cost: product ? String(product.cost ?? 0) : li.unit_cost,
      description: product ? product.name : li.description,
    }));
  }

  function updateLine(index: number, field: string, value: string) {
    setLineItems(prev => prev.map((li, i) => i !== index ? li : { ...li, [field]: value }));
  }

  function addLine() { setLineItems(prev => [...prev, { ...BLANK_LINE }]); }
  function removeLine(index: number) { setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev); }

  const stats = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    const periodFiltered = transactions.filter((t: Transaction) => {
      if (period !== 'all_time') {
        const txDate = t.date ? new Date(t.date) : null;
        if (!txDate || txDate < start || txDate > end) return false;
      }
      return true;
    });

    const income = periodFiltered.filter((t: Transaction) => t.type === "income");
    const expenses = periodFiltered.filter((t: Transaction) => t.type === "expense");
    const totalRevenue = income.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
    const totalCost = income.reduce((s: number, t: Transaction) => s + Number((t as any).cost_amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
    const grossProfit = totalRevenue - totalCost;
    return { totalRevenue, totalExpenses, grossProfit, netProfit: grossProfit - totalExpenses };
  }, [transactions, period]);

  const filtered = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    return transactions.filter((t: Transaction) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (period !== 'all_time') {
        const txDate = t.date ? new Date(t.date) : null;
        if (!txDate || txDate < start || txDate > end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return !!(
          t.client_name?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t as any).vendor_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, typeFilter, period]);

  function startEdit(t: any) {
    setEditState({
      id: t.id,
      type: t.type,
      client_name: t.client_name || "",
      vendor_name: t.vendor_name || "",
      description: t.description || "",
      amount: String(t.amount || ""),
      cost_amount: String(t.cost_amount || ""),
      payment_method: t.payment_method || "cash",
      date: t.date ? t.date.split("T")[0] : new Date().toISOString().split("T")[0],
    });
  }

  async function saveEdit() {
    if (!editState || !business?.id) return;
    if (!editState.amount || parseFloat(editState.amount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch("/api/data/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_transaction",
          business_id: business.id,
          id: editState.id,
          type: editState.type,
          client_name: editState.client_name || null,
          vendor_name: editState.vendor_name || null,
          description: editState.description || null,
          amount: parseFloat(editState.amount),
          cost_amount: parseFloat(editState.cost_amount) || 0,
          payment_method: editState.payment_method,
          date: editState.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      toast({ title: "Transaction updated" });
      setEditState(null);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
      refreshCustomers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setEditLoading(false);
  }

  async function handleAddIncome() {
    const validLines = lineItems.filter(li => li.unit_price && parseFloat(li.unit_price) > 0);
    if (!incomeForm.client_name.trim() || validLines.length === 0 || !business) {
      toast({ title: "Missing info", description: "Enter a client name and at least one item with a price.", variant: "destructive" });
      return;
    }
    setLoading(true);
    let succeeded = 0;
    for (const li of validLines) {
      const qty = parseFloat(li.qty) || 1;
      const amount = qty * (parseFloat(li.unit_price) || 0);
      const costAmount = qty * (parseFloat(li.unit_cost) || 0);
      const res = await fetch("/api/data/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_transaction",
          business_id: business.id,
          type: "income",
          client_name: incomeForm.client_name,
          description: li.description || incomeForm.client_name,
          amount,
          cost_amount: costAmount,
          product_id: li.product_id || null,
          payment_method: incomeForm.payment_method,
          date: incomeForm.date,
        }),
      });
      if (res.ok) succeeded++;
      else { const err = await res.json(); toast({ title: "Error", description: err.error || "Failed", variant: "destructive" }); }
    }
    if (succeeded > 0) {
      toast({ title: `${succeeded} transaction${succeeded > 1 ? "s" : ""} logged`, description: `${incomeForm.client_name} — ${formatCurrency(lineTotals.totalAmount, business.currency)}` });
      setIncomeForm({ ...BLANK_INCOME, date: new Date().toISOString().split("T")[0] });
      setLineItems([{ ...BLANK_LINE }]);
      setOpen(false);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
      refreshCustomers();
    }
    setLoading(false);
  }

  async function handleAddExpense() {
    if (!expenseForm.description.trim() || !expenseForm.amount || !business) {
      toast({ title: "Missing info", description: "Enter a description and amount.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/data/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_transaction",
        business_id: business.id,
        type: "expense",
        vendor_name: expenseForm.vendor_name || null,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        payment_method: expenseForm.payment_method,
        date: expenseForm.date,
      }),
    });
    if (!res.ok) { const err = await res.json(); toast({ title: "Error", description: err.error || "Failed", variant: "destructive" }); }
    else {
      toast({ title: "Expense logged" });
      setExpenseForm({ ...BLANK_EXPENSE, date: new Date().toISOString().split("T")[0] });
      setOpen(false);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function deleteTransaction(id: string) {
    if (!business?.id || !confirm("Delete this transaction?")) return;
    const res = await fetch("/api/data/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_transaction", business_id: business.id, id }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: d.error || "Unknown error", variant: "destructive" });
      return;
    }
    clearCache(`transactions_v2:${bizId ?? "default"}`);
    refetch();
    refreshCustomers();
  }

  const cur = business?.currency ?? "MWK";

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Transactions"
        description="Log income & expenses with auto-profit tracking"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => { clearCache(`transactions_v2:${bizId ?? "default"}`); refetch(); }}
              className="h-8 w-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Quick Add
            </Button>
          </div>
        }
      />

      {/* Stats + Period — outside scroll so dropdown isn't clipped by overflow */}
      <div className="px-4 pt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalRevenue, cur)}</p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
            <p className={`text-lg font-bold ${stats.netProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{formatCurrency(stats.netProfit, cur)}</p>
          </div>
        </div>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full h-9 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
            <SelectItem value="all_time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transaction list */}
        {pageLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No transactions yet.</p>
            <Button size="sm" className="mt-3" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add one</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t: any) => (
              <div key={t.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Normal row */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div 
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    onClick={() => setSelectedTx(t)}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "income" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"}`}>
                      {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.client_name || t.vendor_name || t.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[t.description, formatDate(t.date)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <p className={`text-sm font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-500"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount), cur)}
                    </p>
                    <button
                      onClick={() => editState?.id === t.id ? setEditState(null) : startEdit(t)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit"
                    >
                      {editState?.id === t.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline edit panel */}
                {editState !== null && editState?.id === t.id && (
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      {editState.type === "income" ? (
                        <div>
                          <Label className="text-xs mb-1 block">Client</Label>
                          <Input
                            value={editState.client_name}
                            onChange={e => setEditState(s => s ? { ...s, client_name: e.target.value } : s)}
                            className="h-8 text-sm"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs mb-1 block">Vendor</Label>
                          <Input
                            value={editState.vendor_name}
                            onChange={e => setEditState(s => s ? { ...s, vendor_name: e.target.value } : s)}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs mb-1 block">Amount</Label>
                        <Input
                          type="number"
                          value={editState.amount}
                          onChange={e => setEditState(s => s ? { ...s, amount: e.target.value } : s)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Description</Label>
                      <Input
                        value={editState.description}
                        onChange={e => setEditState(s => s ? { ...s, description: e.target.value } : s)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs mb-1 block">Date</Label>
                        <Input
                          type="date"
                          value={editState.date}
                          onChange={e => setEditState(s => s ? { ...s, date: e.target.value } : s)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Payment</Label>
                        <Select value={editState.payment_method} onValueChange={v => setEditState(s => s ? { ...s, payment_method: v } : s)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {editState.type === "income" && (
                      <div>
                        <Label className="text-xs mb-1 block">Cost amount</Label>
                        <Input
                          type="number"
                          value={editState.cost_amount}
                          onChange={e => setEditState(s => s ? { ...s, cost_amount: e.target.value } : s)}
                          className="h-8 text-sm"
                          placeholder="0"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => setEditState(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1 h-8 gap-1" onClick={saveEdit} disabled={editLoading}>
                        {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="income" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Income</TabsTrigger>
              <TabsTrigger value="expense" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Expense</TabsTrigger>
            </TabsList>

            <TabsContent value="income" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs mb-1 block">Client Name *</Label>
                {customers.length > 0 ? (
                  <SearchableSelect
                    options={customers.map((c: any) => ({ value: c.name, label: c.name }))}
                    value={incomeForm.client_name}
                    onChange={v => setIncomeForm(f => ({ ...f, client_name: v }))}
                    placeholder="Select or type client..."
                    allowCustom
                  />
                ) : (
                  <Input placeholder="e.g. Radiant Son" value={incomeForm.client_name}
                    onChange={e => setIncomeForm(f => ({ ...f, client_name: e.target.value }))} />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Items</Label>
                {lineItems.map((li, idx) => (
                  <div key={idx} className="space-y-1.5 border rounded-lg p-2">
                    {products.length > 0 && (
                      <SearchableSelect
                        options={products.map((p: Product) => ({ value: p.id, label: p.name }))}
                        value={li.product_id}
                        onChange={v => onLineProductChange(idx, v)}
                        placeholder="Pick product (optional)"
                      />
                    )}
                    <Input placeholder="Description" value={li.description}
                      onChange={e => updateLine(idx, "description", e.target.value)} className="text-sm" />
                    <div className="grid grid-cols-3 gap-1.5">
                      <div><Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input type="number" min="1" value={li.qty} onChange={e => updateLine(idx, "qty", e.target.value)} className="text-sm" /></div>
                      <div><Label className="text-xs text-muted-foreground">Price</Label>
                        <Input type="number" min="0" value={li.unit_price} onChange={e => updateLine(idx, "unit_price", e.target.value)} className="text-sm" /></div>
                      <div><Label className="text-xs text-muted-foreground">Cost</Label>
                        <Input type="number" min="0" value={li.unit_cost} onChange={e => updateLine(idx, "unit_cost", e.target.value)} className="text-sm" /></div>
                    </div>
                    {lineItems.length > 1 && <button onClick={() => removeLine(idx)} className="text-xs text-rose-500 hover:underline">Remove</button>}
                  </div>
                ))}
                <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add item</button>
                {lineTotals.totalAmount > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between pt-1 border-t">
                    <span>Total: <strong>{formatCurrency(lineTotals.totalAmount, cur)}</strong></span>
                    <span>Profit: <strong className="text-emerald-600">{formatCurrency(lineTotals.profit, cur)}</strong></span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs mb-1 block">Payment</Label>
                  <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-xs mb-1 block">Date</Label>
                  <Input type="date" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} className="text-sm" /></div>
              </div>
              <Button className="w-full" onClick={handleAddIncome} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Log Income
              </Button>
            </TabsContent>

            <TabsContent value="expense" className="space-y-3 mt-3">
              <div><Label className="text-xs mb-1 block">Vendor (optional)</Label>
                <Input placeholder="e.g. Paychangu" value={expenseForm.vendor_name}
                  onChange={e => setExpenseForm(f => ({ ...f, vendor_name: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">Description *</Label>
                <Input placeholder="e.g. Office supplies" value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">Amount *</Label>
                <Input type="number" min="0" placeholder="0" value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs mb-1 block">Payment</Label>
                  <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-xs mb-1 block">Date</Label>
                  <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} className="text-sm" /></div>
              </div>
              <Button className="w-full" onClick={handleAddExpense} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Log Expense
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                selectedTx?.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'
              }`}>
                {selectedTx?.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <span>{selectedTx?.client_name || selectedTx?.vendor_name || selectedTx?.description || 'Transaction'}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Amount</span>
                <span className={`font-bold text-base ${
                  selectedTx.type === 'income' ? 'text-emerald-600' : 'text-rose-500'
                }`}>
                  {selectedTx.type === 'income' ? '+' : '-'}{formatCurrency(Number(selectedTx.amount), cur)}
                </span>
              </div>
              {selectedTx.type === 'income' && Number(selectedTx.cost_amount) > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Cost of Sale</span>
                  <span className="font-medium">{formatCurrency(Number(selectedTx.cost_amount), cur)}</span>
                </div>
              )}
              {selectedTx.type === 'income' && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(Number(selectedTx.amount) - Number(selectedTx.cost_amount || 0), cur)}</span>
                </div>
              )}
              {selectedTx.description && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">{selectedTx.description}</span>
                </div>
              )}
              {selectedTx.client_name && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{selectedTx.client_name}</span>
                </div>
              )}
              {selectedTx.vendor_name && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Vendor</span>
                  <span className="font-medium">{selectedTx.vendor_name}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{formatDate(selectedTx.date)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-medium capitalize">{selectedTx.payment_method || 'Cash'}</span>
              </div>
              {selectedTx.category_name && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{selectedTx.category_name}</span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setSelectedTx(null); startEdit(selectedTx); }}>
                  <Pencil className="h-4 w-4 mr-1.5" /> Edit
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => { deleteTransaction(selectedTx.id); setSelectedTx(null); }}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
