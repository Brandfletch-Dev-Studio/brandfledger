"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, TrendingUp, TrendingDown, Loader2, Trash2, Tag, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCachedFetch, clearCache } from "@/hooks/use-cached-fetch";
import type { Transaction, Category, Product } from "@/types";
import { PAYMENT_METHODS } from "@/types";

const BLANK_INCOME = {
  client_name: "",
  description: "",
  amount: "",
  cost_amount: "",
  category_id: "",
  product_id: "",
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
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);
  const [catForm, setCatForm] = useState(BLANK_CATEGORY);

  // Cached fetch of all page data
  const bizId = typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null;
  const { data: pageData, loading: pageLoading, refreshing, refetch } = useCachedFetch({
    key: `transactions:${bizId ?? "default"}`,
    fetcher: async () => {
      const sb = createClient();
      const { data: biz, error } = await getDefaultBusiness(sb);
      if (error || !biz) throw new Error("No business found");
      setBusiness(biz);
      const [txRes, catRes, prodRes] = await Promise.all([
        sb.from("transactions").select("*").eq("business_id", biz.id).order("date", { ascending: false }),
        sb.from("categories").select("*").eq("business_id", biz.id).order("sort_order"),
        sb.from("products").select("*").eq("business_id", biz.id).eq("is_active", true).order("name"),
      ]);
      return {
        transactions: (txRes.data ?? []) as Transaction[],
        categories: (catRes.data ?? []) as Category[],
        products: (prodRes.data ?? []) as Product[],
      };
    },
  });

  const transactions = pageData?.transactions ?? [];
  const categories = pageData?.categories ?? [];
  const products = pageData?.products ?? [];

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  // Profit preview
  const profitPreview = useMemo(() => {
    const amount = parseFloat(incomeForm.amount) || 0;
    const cost = parseFloat(incomeForm.cost_amount) || 0;
    const profit = amount - cost;
    const margin = amount > 0 ? (profit / amount * 100) : 0;
    return { cost, profit, margin };
  }, [incomeForm.amount, incomeForm.cost_amount]);

  function onProductChange(productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      setIncomeForm(p => ({
        ...p,
        product_id: productId,
        amount: String(product.price),
        cost_amount: String(product.cost ?? 0),
        description: product.name,
      }));
    } else {
      setIncomeForm(p => ({ ...p, product_id: "" }));
    }
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
    if (!incomeForm.client_name || !incomeForm.amount || !business) return;
    setLoading(true);
    const sb = createClient();
    const amount = parseFloat(incomeForm.amount);
    const costAmount = parseFloat(incomeForm.cost_amount) || 0;
    const cat = categories.find(c => c.id === incomeForm.category_id);

    const { error } = await sb.from("transactions").insert({
      business_id: business.id,
      type: "income",
      category_id: incomeForm.category_id || null,
      category_name: cat?.name || null,
      client_name: incomeForm.client_name,
      description: incomeForm.description || `${incomeForm.client_name}`,
      amount,
      cost_amount: costAmount,
      product_id: incomeForm.product_id || null,
      payment_method: incomeForm.payment_method,
      date: incomeForm.date,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Income logged", description: `${incomeForm.client_name} — ${formatCurrency(amount, business.currency)}` });
      setIncomeForm({ ...BLANK_INCOME, date: new Date().toISOString().split("T")[0] });
      setOpen(false);
      clearCache(`transactions:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function handleAddExpense() {
    if (!expenseForm.description || !expenseForm.amount || !business) return;
    setLoading(true);
    const sb = createClient();
    const amount = parseFloat(expenseForm.amount);
    const cat = categories.find(c => c.id === expenseForm.category_id);

    const { error } = await sb.from("transactions").insert({
      business_id: business.id,
      type: "expense",
      category_id: expenseForm.category_id || null,
      category_name: cat?.name || null,
      vendor_name: expenseForm.vendor_name || null,
      description: expenseForm.description,
      amount,
      payment_method: expenseForm.payment_method,
      date: expenseForm.date,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense logged", description: `${expenseForm.description} — ${formatCurrency(amount, business.currency)}` });
      setExpenseForm({ ...BLANK_EXPENSE, date: new Date().toISOString().split("T")[0] });
      setOpen(false);
      clearCache(`transactions:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function handleAddCategory() {
    if (!catForm.name || !business) return;
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.from("categories").insert({
      business_id: business.id,
      name: catForm.name,
      type: catForm.type,
      color: catForm.color || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Category created" });
      setCatForm(BLANK_CATEGORY);
      setCatOpen(false);
      clearCache(`transactions:${bizId ?? "default"}`);
      refetch();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    const sb = createClient();
    const { error } = await sb.from("transactions").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      clearCache(`transactions:${bizId ?? "default"}`);
      refetch();
      toast({ title: "Deleted" });
    }
  }

  const currency = business?.currency ?? "USD";

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
                <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Quick Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="income" className="gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />Income
                    </TabsTrigger>
                    <TabsTrigger value="expense" className="gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500" />Expense
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="income" className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label>Client name *</Label>
                      <Input placeholder="e.g. John Smith" value={incomeForm.client_name} onChange={e => setIncomeForm(p => ({ ...p, client_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input placeholder="What was this for?" value={incomeForm.description} onChange={e => setIncomeForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Amount ({currency}) *</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cost ({currency})</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={incomeForm.cost_amount} onChange={e => setIncomeForm(p => ({ ...p, cost_amount: e.target.value }))} />
                      </div>
                    </div>
                    {/* Profit preview */}
                    {incomeForm.amount && parseFloat(incomeForm.amount) > 0 && (
                      <div className="flex items-center gap-2 text-sm rounded-lg bg-muted/50 px-3 py-2">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Profit: <strong className="text-emerald-600">{formatCurrency(profitPreview.profit, currency)}</strong></span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{profitPreview.margin.toFixed(0)}% margin</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>Product / Service</Label>
                      <Select value={incomeForm.product_id} onValueChange={onProductChange}>
                        <SelectTrigger><SelectValue placeholder="Auto-fill price & cost" /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, currency)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Income category</Label>
                        <Select value={incomeForm.category_id} onValueChange={v => setIncomeForm(p => ({ ...p, category_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {incomeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Payment method</Label>
                        <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(p => ({ ...p, payment_method: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <Button onClick={handleAddIncome} disabled={loading || !incomeForm.client_name || !incomeForm.amount} className="w-full">
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Plus className="mr-2 h-4 w-4" />Log Income</>}
                    </Button>
                  </TabsContent>
                  <TabsContent value="expense" className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <Label>Description *</Label>
                      <Input placeholder="e.g. Fuel, rent, supplies" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Amount ({currency}) *</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Vendor (optional)</Label>
                        <Input placeholder="Who did you pay?" value={expenseForm.vendor_name} onChange={e => setExpenseForm(p => ({ ...p, vendor_name: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Expense category</Label>
                        <Select value={expenseForm.category_id} onValueChange={v => setExpenseForm(p => ({ ...p, category_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Payment method</Label>
                        <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(p => ({ ...p, payment_method: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <Button onClick={handleAddExpense} disabled={loading || !expenseForm.description || !expenseForm.amount} className="w-full">
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Plus className="mr-2 h-4 w-4" />Log Expense</>}
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search client, description, vendor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income only</SelectItem>
              <SelectItem value="expense">Expenses only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
          <Tag className="mr-1.5 h-4 w-4" />Manage Categories
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</p>
          <p className="text-sm sm:text-lg font-bold text-emerald-600 truncate">{formatCurrency(stats.totalRevenue, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</p>
          <p className="text-sm sm:text-lg font-bold text-rose-600 truncate">{formatCurrency(stats.totalCost, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross Profit</p>
          <p className="text-sm sm:text-lg font-bold text-primary truncate">{formatCurrency(stats.grossProfit, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Expenses</p>
          <p className="text-sm sm:text-lg font-bold text-rose-600 truncate">{formatCurrency(stats.totalExpenses, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Profit</p>
          <p className="text-sm sm:text-lg font-bold text-emerald-600 truncate">{formatCurrency(stats.netProfit, currency)}</p>
        </div>
        <div className="rounded-lg border bg-card p-2.5 sm:p-3">
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Margin</p>
          <p className="text-sm sm:text-lg font-bold truncate">{stats.avgMargin.toFixed(0)}%</p>
        </div>
      </div>

      {/* Transactions table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Date</th>
                <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Client / Vendor</th>
                <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Description</th>
                <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Category</th>
                <th className="text-right font-semibold text-muted-foreground p-3 whitespace-nowrap">Amount</th>
                <th className="text-right font-semibold text-muted-foreground p-3 whitespace-nowrap">Cost</th>
                <th className="text-right font-semibold text-muted-foreground p-3 whitespace-nowrap">Profit</th>
                <th className="text-center font-semibold text-muted-foreground p-3 whitespace-nowrap">Margin</th>
                <th className="text-center font-semibold text-muted-foreground p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  {search || typeFilter !== "all" ? "No transactions match your filters." : "No transactions yet. Click \"Quick Add\" to log your first one."}
                </td></tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="p-3 whitespace-nowrap font-medium">{t.type === "income" ? t.client_name : t.vendor_name || "—"}</td>
                    <td className="p-3 max-w-[200px] truncate">{t.description}</td>
                    <td className="p-3 whitespace-nowrap">
                      {t.category_name ? <Badge variant="secondary" className="text-xs">{t.category_name}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className={`p-3 text-right font-semibold whitespace-nowrap ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "−"}{formatCurrency(Math.abs(Number(t.amount)), currency)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                      {t.cost_amount ? formatCurrency(Number(t.cost_amount), currency) : "—"}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      {t.type === "income" && t.cost_amount ? (
                        <span className="text-emerald-600">{formatCurrency(Number(t.profit || Number(t.amount) - Number(t.cost_amount)), currency)}</span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {t.type === "income" && t.cost_amount && Number(t.amount) > 0 ? (
                        <Badge variant="outline" className="text-xs">{((Number(t.profit || Number(t.amount) - Number(t.cost_amount)) / Number(t.amount)) * 100).toFixed(0)}%</Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Category manager dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Ads, Consulting" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={catForm.type} onValueChange={v => setCatForm(p => ({ ...p, type: v as "income" | "expense" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddCategory} disabled={loading || !catForm.name} size="sm">
                <Plus className="mr-1.5 h-4 w-4" />Add Category
              </Button>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Current categories</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {categories.length === 0 ? <p className="text-xs text-muted-foreground">No categories yet.</p> : categories.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-sm py-1">
                    <Badge variant={c.type === "income" ? "default" : "secondary"} className="text-xs">{c.type}</Badge>
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
