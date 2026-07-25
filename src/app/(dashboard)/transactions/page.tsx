"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, TrendingUp, TrendingDown, Loader2, Trash2, Tag, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCachedFetch, clearCache } from "@/hooks/use-cached-fetch";
import type { Transaction, Category, Product } from "@/types";
import { PAYMENT_METHODS } from "@/types";
import { SearchableSelect } from "@/components/ui/searchable-select";

const BLANK_LINE = { product_id: "", description: "", qty: "1", unit_price: "", unit_cost: "" };
const BLANK_INCOME = {
  client_name: "",
  category_id: "",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};

const BLANK_EXPENSE = {
  description: "",
  amount: "",
  category_id: "",
  vendor_name: "",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};

const BLANK_CATEGORY = { name: "", type: "income" as "income" | "expense", color: "" };

export default function TransactionsPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [incomeForm, setIncomeForm] = useState(BLANK_INCOME);
  const [lineItems, setLineItems] = useState([{ ...BLANK_LINE }]);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);
  const [catForm, setCatForm] = useState(BLANK_CATEGORY);

  const bizId = typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null;
  const { data: pageData, loading: pageLoading, refreshing, refetch } = useCachedFetch({
    key: `transactions_v2:${bizId ?? "default"}`,
    fetcher: async () => {
      const url = bizId ? `/api/data/transactions?business_id=${bizId}` : "/api/data/transactions";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load data");
      const data = await res.json();
      setBusiness(data.business);
      return {
        transactions: (data.transactions ?? []) as Transaction[],
        categories: (data.categories ?? []) as Category[],
        products: (data.products ?? []) as Product[],
      };
    },
  });

  const transactions = pageData?.transactions ?? [];
  const categories = pageData?.categories ?? [];
  const products = pageData?.products ?? [];

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  const lineTotals = useMemo(() => {
    let totalAmount = 0, totalCost = 0;
    for (const li of lineItems) {
      const qty = parseFloat(li.qty) || 1;
      const price = parseFloat(li.unit_price) || 0;
      const cost = parseFloat(li.unit_cost) || 0;
      totalAmount += qty * price;
      totalCost += qty * cost;
    }
    const profit = totalAmount - totalCost;
    const margin = totalAmount > 0 ? (profit / totalAmount * 100) : 0;
    return { totalAmount, totalCost, profit, margin };
  }, [lineItems]);

  function onLineProductChange(index: number, productId: string) {
    const product = products.find(p => p.id === productId);
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

  function addLine() {
    setLineItems(prev => [...prev, { ...BLANK_LINE }]);
  }

  function removeLine(index: number) {
    setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === "income");
    const expenses = transactions.filter(t => t.type === "expense");
    const totalRevenue = income.reduce((s, t) => s + Number(t.amount), 0);
    const totalCost = income.reduce((s, t) => s + Number(t.cost_amount || 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const avgMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
    return { totalRevenue, totalCost, totalExpenses, grossProfit, netProfit, avgMargin, salesCount: income.length };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.client_name?.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category_name?.toLowerCase().includes(q) ||
          t.vendor_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, typeFilter]);

  async function handleAddIncome() {
    const validLines = lineItems.filter(li => li.unit_price && parseFloat(li.unit_price) > 0);
    if (!incomeForm.client_name || validLines.length === 0 || !business) return;
    setLoading(true);

    const cat = categories.find(c => c.id === incomeForm.category_id);
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
          category_id: incomeForm.category_id || null,
          category_name: cat?.name || null,
          client_name: incomeForm.client_name,
          description: li.description || li.product_id || incomeForm.client_name,
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
        toast({ title: "Error on line " + (succeeded + 1), description: err.error || "Failed", variant: "destructive" });
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
    if (!expenseForm.description || !expenseForm.amount || !business) return;
    setLoading(true);
    const amount = parseFloat(expenseForm.amount);
    const cat = categories.find(c => c.id === expenseForm.category_id);

    const res = await fetch("/api/data/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_transaction",
        business_id: business.id,
        type: "expense",
        category_id: expenseForm.category_id || null,
        category_name: cat?.name || null,
        vendor_name: expenseForm.vendor_name || null,
        description: expenseForm.description,
        amount,
        payment_method: expenseForm.payment_method,
        date: expenseForm.date,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error || "Failed to add expense", variant: "destructive" });
    } else {
      toast({ title: "Expense logged", description: `${expenseForm.description} — ${formatCurrency(amount, business.currency)}` });
      setExpenseForm({ ...BLANK_EXPENSE, date: new Date().toISOString().split("T")[0] });
      setOpen(false);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function handleAddCategory() {
    if (!catForm.name || !business) return;
    setLoading(true);
    const res = await fetch("/api/data/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_category",
        business_id: business.id,
        name: catForm.name,
        type: catForm.type,
        color: catForm.color || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error || "Failed", variant: "destructive" });
    } else {
      toast({ title: "Category created" });
      setCatForm(BLANK_CATEGORY);
      setCatOpen(false);
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const res = await fetch("/api/data/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_transaction", business_id: business.id, id }),
    });
    if (!res.ok) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    } else {
      clearCache(`transactions_v2:${bizId ?? "default"}`);
      refetch();
      toast({ title: "Deleted" });
    }
  }

  const currency = business?.currency ?? "MWK";

  if (pageLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
        <Header title="Transactions" description="Log income & expenses with automatic profit tracking" />
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <Header title="Transactions" description="Log income & expenses with automatic profit tracking"
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" /> Quick Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Transaction</DialogTitle>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="income" className="gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Income
                    </TabsTrigger>
                    <TabsTrigger value="expense" className="gap-1">
                      <TrendingDown className="h-3.5 w-3.5" /> Expense
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="income" className="space-y-3 mt-4">
                    {/* Client & meta */}
                    <div>
                      <Label className="text-xs">Client Name *</Label>
                      <Input value={incomeForm.client_name} onChange={e => setIncomeForm(p => ({ ...p, client_name: e.target.value }))} placeholder="e.g. Radiant Son" className="h-9" />
                    </div>

                    {/* Line items */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_44px_68px_68px_24px] gap-1 items-center">
                        <Label className="text-[10px] text-muted-foreground">Product</Label>
                        <Label className="text-[10px] text-muted-foreground text-center">Qty</Label>
                        <Label className="text-[10px] text-muted-foreground text-right">Price</Label>
                        <Label className="text-[10px] text-muted-foreground text-right">Cost</Label>
                        <span />
                      </div>
                      {lineItems.map((li, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_44px_68px_68px_24px] gap-1 items-center">
                          <SearchableSelect
                            options={[
                              { value: "__custom__", label: "Custom…" },
                              ...products.map(p => ({ value: p.id, label: p.name, subtitle: formatCurrency(p.price, currency) }))
                            ]}
                            value={li.product_id || (li.description ? "__custom__" : "")}
                            onChange={v => {
                              if (v === "__custom__") {
                                updateLine(idx, "product_id", "");
                              } else {
                                onLineProductChange(idx, v);
                              }
                            }}
                            placeholder="Select / type…"
                            searchPlaceholder="Search products…"
                          />
                          <Input
                            type="number"
                            value={li.qty}
                            onChange={e => updateLine(idx, "qty", e.target.value)}
                            className="h-8 text-center px-1 text-xs"
                            min="1"
                          />
                          <Input
                            type="number"
                            value={li.unit_price}
                            onChange={e => updateLine(idx, "unit_price", e.target.value)}
                            placeholder="0"
                            className="h-8 text-right px-1 text-xs"
                          />
                          <Input
                            type="number"
                            value={li.unit_cost}
                            onChange={e => updateLine(idx, "unit_cost", e.target.value)}
                            placeholder="0"
                            className="h-8 text-right px-1 text-xs"
                          />
                          <button
                            onClick={() => removeLine(idx)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addLine}
                        className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline py-0.5"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add item
                      </button>
                    </div>

                    {/* Totals preview */}
                    {lineTotals.totalAmount > 0 && (
                      <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold">{formatCurrency(lineTotals.totalAmount, currency)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Cost</span>
                          <span>{formatCurrency(lineTotals.totalCost, currency)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t pt-1">
                          <span className="text-muted-foreground">Profit</span>
                          <span className={lineTotals.profit >= 0 ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                            {formatCurrency(lineTotals.profit, currency)} ({lineTotals.margin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Category</Label>
                        <SearchableSelect
                          options={incomeCategories.map(c => ({ value: c.id, label: c.name }))}
                          value={incomeForm.category_id}
                          onChange={v => setIncomeForm(p => ({ ...p, category_id: v }))}
                          placeholder="Select..."
                          searchPlaceholder="Search categories..."
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Payment Method</Label>
                        <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(p => ({ ...p, payment_method: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} className="h-9" />
                    </div>
                    <Button onClick={handleAddIncome} disabled={loading || !incomeForm.client_name || lineTotals.totalAmount === 0} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Log Income${lineItems.filter(li => parseFloat(li.unit_price) > 0).length > 1 ? ` (${lineItems.filter(li => parseFloat(li.unit_price) > 0).length} items)` : ""}`}
                    </Button>
                  </TabsContent>

                  <TabsContent value="expense" className="space-y-3 mt-4">
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Fuel" className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Vendor (optional)</Label>
                      <Input value={expenseForm.vendor_name} onChange={e => setExpenseForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="e.g. Asher" className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Amount (MWK)</Label>
                        <Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} placeholder="10000" className="h-9" />
                      </div>
                      <div>
                        <Label className="text-xs">Category</Label>
                        <SearchableSelect
                          options={expenseCategories.map(c => ({ value: c.id, label: c.name }))}
                          value={expenseForm.category_id}
                          onChange={v => setExpenseForm(p => ({ ...p, category_id: v }))}
                          placeholder="Select..."
                          searchPlaceholder="Search categories..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className="h-9" />
                      </div>
                      <div>
                        <Label className="text-xs">Payment Method</Label>
                        <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(p => ({ ...p, payment_method: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleAddExpense} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Expense"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">REVENUE</p><p className="text-sm sm:text-base font-bold text-green-600">{formatCurrency(stats.totalRevenue, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">COST</p><p className="text-sm sm:text-base font-bold text-red-600">{formatCurrency(stats.totalCost, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">GROSS PROFIT</p><p className="text-sm sm:text-base font-bold text-violet-600">{formatCurrency(stats.grossProfit, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">EXPENSES</p><p className="text-sm sm:text-base font-bold text-red-600">{formatCurrency(stats.totalExpenses, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">NET PROFIT</p><p className="text-sm sm:text-base font-bold text-violet-600">{formatCurrency(stats.netProfit, currency)}</p></CardContent></Card>
        <Card><CardContent className="p-2 sm:p-3"><p className="text-[10px] sm:text-xs text-muted-foreground font-medium">AVG MARGIN</p><p className="text-sm sm:text-base font-bold">{stats.avgMargin.toFixed(1)}%</p></CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, description, vendor..." className="h-9 pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <Tag className="h-3.5 w-3.5" /> Manage Categories
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {categories.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Existing Categories</Label>
                  {categories.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{c.type}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label className="text-xs">Category Name</Label>
                <Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ad Sales" className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={catForm.type} onValueChange={v => setCatForm(p => ({ ...p, type: v as "income" | "expense" }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddCategory} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Category"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions Table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/50 border-b">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-2 sm:p-3 font-medium">Date</th>
              <th className="p-2 sm:p-3 font-medium">Client / Vendor</th>
              <th className="p-2 sm:p-3 font-medium">Description</th>
              <th className="p-2 sm:p-3 font-medium">Category</th>
              <th className="p-2 sm:p-3 font-medium text-right">Amount</th>
              <th className="p-2 sm:p-3 font-medium text-right">Cost</th>
              <th className="p-2 sm:p-3 font-medium text-right">Profit</th>
              <th className="p-2 sm:p-3 font-medium text-right">Margin</th>
              <th className="p-2 sm:p-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No transactions yet. Click "Quick Add" to log your first one.</td></tr>
            ) : (
              filtered.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-2 sm:p-3 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="p-2 sm:p-3 whitespace-nowrap">{t.client_name || t.vendor_name || "—"}</td>
                  <td className="p-2 sm:p-3">{t.description}</td>
                  <td className="p-2 sm:p-3"><span className="text-xs text-muted-foreground">{t.category_name || "—"}</span></td>
                  <td className={`p-2 sm:p-3 text-right font-medium whitespace-nowrap ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount), currency)}
                  </td>
                  <td className="p-2 sm:p-3 text-right text-muted-foreground whitespace-nowrap">{t.type === "income" ? formatCurrency(Number(t.cost_amount || 0), currency) : "—"}</td>
                  <td className="p-2 sm:p-3 text-right font-medium whitespace-nowrap">{t.type === "income" ? <span className={Number(t.profit) >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(Number(t.profit), currency)}</span> : "—"}</td>
                  <td className="p-2 sm:p-3 text-right text-muted-foreground whitespace-nowrap">{t.type === "income" ? `${Number(t.margin || 0).toFixed(1)}%` : "—"}</td>
                  <td className="p-2 sm:p-3">
                    <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
