"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, TrendingUp, TrendingDown, Loader2, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCachedFetch, clearCache } from "@/hooks/use-cached-fetch";
import type { Transaction, Product } from "@/types";
import { PAYMENT_METHODS } from "@/types";
import { SearchableSelect } from "@/components/ui/searchable-select";

const BLANK_LINE = { product_id: "", description: "", qty: "1", unit_price: "", unit_cost: "" };
const BLANK_INCOME = {
  client_name: "",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};
const BLANK_EXPENSE = {
  description: "",
  amount: "",
  vendor_name: "",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};

export default function TransactionsPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [incomeForm, setIncomeForm] = useState(BLANK_INCOME);
  const [lineItems, setLineItems] = useState([{ ...BLANK_LINE }]);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);

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

  // Also load customers for client selection
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    const url = bizId ? `/api/data/customers?business_id=${bizId}` : "/api/data/customers";
    fetch(url).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.customers) setCustomers(d.customers);
    }).catch(() => {});
  }, [bizId]);

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
    const income = transactions.filter((t: Transaction) => t.type === "income");
    const expenses = transactions.filter((t: Transaction) => t.type === "expense");
    const totalRevenue = income.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
    const totalCost = income.reduce((s: number, t: Transaction) => s + Number((t as any).cost_amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
    const grossProfit = totalRevenue - totalCost;
    return { totalRevenue, totalExpenses, grossProfit, netProfit: grossProfit - totalExpenses };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t: Transaction) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.client_name?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t as any).vendor_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, typeFilter]);

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
      else {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed", variant: "destructive" });
      }
    }
    if (succeeded > 0) {
      toast({ title: `${succeeded} transaction${succeeded > 1 ? "s" : ""} logged`, description: `${incomeForm.client_name} — ${formatCurrency(lineTotals.totalAmount, business.currency)}` });
      setIncomeForm({ ...BLANK_INCOME, date: new Date().toISOString().split("T")[0] });
      setLineItems([{ ...BLANK_LINE }]);
      setOpen(false);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
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
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error || "Failed", variant: "destructive" });
    } else {
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
    await fetch(`/api/data/transactions?id=${id}&business_id=${business.id}`, { method: "DELETE" });
    clearCache(`transactions_v2:${bizId ?? "default"}`);
    refetch();
  }

  const cur = business?.currency ?? "MWK";

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Transactions"
        subtitle="Log income & expenses with auto-profit tracking"
        action={
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats */}
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
              <div key={t.id} className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${t.type === "income" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"}`}>
                    {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.client_name || t.vendor_name || t.description}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description} · {formatDate(t.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-sm font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-500"}`}>
                    {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount), cur)}
                  </p>
                  <button onClick={() => deleteTransaction(t.id)} className="text-muted-foreground hover:text-rose-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="income" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Income</TabsTrigger>
              <TabsTrigger value="expense" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Expense</TabsTrigger>
            </TabsList>

            {/* ── INCOME TAB ── */}
            <TabsContent value="income" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs mb-1 block">Client Name *</Label>
                {customers.length > 0 ? (
                  <SearchableSelect
                    options={[
                      ...customers.map((c: any) => ({ value: c.name, label: c.name })),
                    ]}
                    value={incomeForm.client_name}
                    onChange={v => setIncomeForm(f => ({ ...f, client_name: v }))}
                    placeholder="Select or type client..."
                    allowCustom
                  />
                ) : (
                  <Input
                    placeholder="e.g. Radiant Son"
                    value={incomeForm.client_name}
                    onChange={e => setIncomeForm(f => ({ ...f, client_name: e.target.value }))}
                  />
                )}
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <Label className="text-xs">Items</Label>
                {lineItems.map((li, idx) => (
                  <div key={idx} className="space-y-1.5 border rounded-lg p-2">
                    {/* Product picker */}
                    {products.length > 0 && (
                      <SearchableSelect
                        options={products.map((p: Product) => ({ value: p.id, label: `${p.name} — ${formatCurrency(p.price, cur)}` }))}
                        value={li.product_id}
                        onChange={v => onLineProductChange(idx, v)}
                        placeholder="Pick product (optional)"
                      />
                    )}
                    <Input
                      placeholder="Description"
                      value={li.description}
                      onChange={e => updateLine(idx, "description", e.target.value)}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input type="number" min="1" value={li.qty}
                          onChange={e => updateLine(idx, "qty", e.target.value)} className="text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Price</Label>
                        <Input type="number" min="0" value={li.unit_price}
                          onChange={e => updateLine(idx, "unit_price", e.target.value)} className="text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Cost</Label>
                        <Input type="number" min="0" value={li.unit_cost}
                          onChange={e => updateLine(idx, "unit_cost", e.target.value)} className="text-sm" />
                      </div>
                    </div>
                    {lineItems.length > 1 && (
                      <button onClick={() => removeLine(idx)} className="text-xs text-rose-500 hover:underline">Remove</button>
                    )}
                  </div>
                ))}
                <button onClick={addLine} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add item
                </button>
                {lineTotals.totalAmount > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between pt-1 border-t">
                    <span>Total: <strong>{formatCurrency(lineTotals.totalAmount, cur)}</strong></span>
                    <span>Profit: <strong className="text-emerald-600">{formatCurrency(lineTotals.profit, cur)}</strong></span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Payment</Label>
                  <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date</Label>
                  <Input type="date" value={incomeForm.date}
                    onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} className="text-sm" />
                </div>
              </div>

              <Button className="w-full" onClick={handleAddIncome} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Log Income
              </Button>
            </TabsContent>

            {/* ── EXPENSE TAB ── */}
            <TabsContent value="expense" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs mb-1 block">Description *</Label>
                <Input placeholder="e.g. Fuel, Rent, Supplies"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Amount *</Label>
                <Input type="number" min="0" placeholder="0"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Vendor / Supplier</Label>
                <Input placeholder="e.g. Total, Shoprite"
                  value={expenseForm.vendor_name}
                  onChange={e => setExpenseForm(f => ({ ...f, vendor_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Payment</Label>
                  <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date</Label>
                  <Input type="date" value={expenseForm.date}
                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} className="text-sm" />
                </div>
              </div>

              <Button className="w-full" onClick={handleAddExpense} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Log Expense
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
