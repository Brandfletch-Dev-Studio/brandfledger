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
import { Plus, Search, TrendingUp, TrendingDown, Loader2, Receipt, Trash2, Tag } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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

const BLANK_CATEGORY = { name: "", type: "income" as const, color: "" };

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [incomeForm, setIncomeForm] = useState(BLANK_INCOME);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);
  const [catForm, setCatForm] = useState(BLANK_CATEGORY);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    const sb = createClient();
    const { data: biz, error } = await getDefaultBusiness(sb);
    if (error || !biz) {
      toast({ title: "No business found", description: "Set up your business first.", variant: "destructive" });
      setPageLoading(false);
      return;
    }
    setBusiness(biz);
    const [txRes, catRes, prodRes] = await Promise.all([
      sb.from("transactions").select("*").eq("business_id", biz.id).order("date", { ascending: false }),
      sb.from("categories").select("*").eq("business_id", biz.id).order("sort_order"),
      sb.from("products").select("*").eq("business_id", biz.id).eq("is_active", true).order("name"),
    ]);
    if (txRes.error) toast({ title: "Couldn't load transactions", description: txRes.error.message, variant: "destructive" });
    setTransactions(txRes.data ?? []);
    setCategories(catRes.data ?? []);
    setProducts(prodRes.data ?? []);
    setPageLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  // Profit preview for income form
  const profitPreview = useMemo(() => {
    const amount = parseFloat(incomeForm.amount) || 0;
    const cost = parseFloat(incomeForm.cost_amount) || 0;
    const profit = amount - cost;
    const margin = amount > 0 ? (profit / amount * 100) : 0;
    return { cost, profit, margin };
  }, [incomeForm.amount, incomeForm.cost_amount]);

  // When product is selected, auto-fill price & cost
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

  // Summary stats
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
        return (t.client_name?.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category_name?.toLowerCase().includes(q) || t.vendor_name?.toLowerCase().includes(q));
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
      loadData();
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
      loadData();
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
      loadData();
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
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast({ title: "Deleted" });
    }
  }

  const currency = business?.currency ?? "USD";

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Transactions" description="Log income & expenses with automatic profit tracking" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(stats.totalRevenue, currency)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stats.salesCount} sale{stats.salesCount !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cost of Sales</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{formatCurrency(stats.totalCost, currency)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">From products sold</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gross Profit</p>
            <p className={`text-xl font-bold mt-1 ${stats.grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatCurrency(stats.grossProfit, currency)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stats.avgMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Profit</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-100 dark:bg-rose-500/10">
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <p className={`text-xl font-bold ${stats.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {formatCurrency(stats.netProfit, currency)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">After all expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search client, description, vendor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-9">
                <Tag className="h-4 w-4 mr-1" /> Categories
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                {/* Existing categories */}
                {categories.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {categories.map(c => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={c.type === "income" ? "default" : "secondary"} className="text-xs">{c.type}</Badge>
                          <span className="text-sm">{c.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {categories.length > 0 && <div className="border-t pt-3" />}
                {/* Add new category */}
                <div className="space-y-2">
                  <Input placeholder="Category name (e.g. Ad Sales, Materials, Fuel)" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={catForm.type} onValueChange={v => setCatForm(p => ({ ...p, type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Color (optional)" value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color: e.target.value }))} />
                  </div>
                  <Button className="w-full" disabled={loading || !catForm.name} onClick={handleAddCategory}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-1" />}
                    Add Category
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9"><Plus className="h-4 w-4 mr-1" /> Quick Add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="income"><TrendingUp className="h-4 w-4 mr-1" /> Income</TabsTrigger>
                  <TabsTrigger value="expense"><TrendingDown className="h-4 w-4 mr-1" /> Expense</TabsTrigger>
                </TabsList>

                {/* INCOME TAB */}
                <TabsContent value="income" className="space-y-3 mt-4">
                  {/* Product quick-select (optional) */}
                  {products.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-sm">Select Product (optional — auto-fills price & cost)</Label>
                      <Select value={incomeForm.product_id} onValueChange={onProductChange}>
                        <SelectTrigger><SelectValue placeholder="Choose a product..." /></SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, currency)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-sm">Client Name *</Label>
                    <Input placeholder="Customer name" value={incomeForm.client_name} onChange={e => setIncomeForm(p => ({ ...p, client_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Amount ({currency}) *</Label>
                      <Input type="number" placeholder="0" value={incomeForm.amount} onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Category</Label>
                      <Select value={incomeForm.category_id} onValueChange={v => setIncomeForm(p => ({ ...p, category_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {incomeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Cost ({currency})</Label>
                      <Input type="number" placeholder="0" value={incomeForm.cost_amount} onChange={e => setIncomeForm(p => ({ ...p, cost_amount: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">Auto-filled from product, or enter manually</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Date</Label>
                      <Input type="date" value={incomeForm.date} onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Payment Method</Label>
                    <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(p => ({ ...p, payment_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Description (optional)</Label>
                    <Input placeholder="What was this for?" value={incomeForm.description} onChange={e => setIncomeForm(p => ({ ...p, description: e.target.value }))} />
                  </div>

                  {/* Profit Preview */}
                  {incomeForm.amount && (
                    <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-medium">{formatCurrency(parseFloat(incomeForm.amount) || 0, currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency(profitPreview.cost, currency)}</span>
                      </div>
                      <div className="border-t pt-1.5 flex justify-between text-sm">
                        <span className="font-medium">Profit</span>
                        <span className={`font-bold ${profitPreview.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatCurrency(profitPreview.profit, currency)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margin</span>
                        <span className="font-medium">{profitPreview.margin.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" disabled={loading || !incomeForm.client_name || !incomeForm.amount} onClick={handleAddIncome}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                    Add Income
                  </Button>
                </TabsContent>

                {/* EXPENSE TAB */}
                <TabsContent value="expense" className="space-y-3 mt-4">
                  <div className="space-y-1">
                    <Label className="text-sm">Description *</Label>
                    <Input placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Amount ({currency}) *</Label>
                      <Input type="number" placeholder="0" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Category</Label>
                      <Select value={expenseForm.category_id} onValueChange={v => setExpenseForm(p => ({ ...p, category_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Vendor / Payee</Label>
                    <Input placeholder="Who was this paid to?" value={expenseForm.vendor_name} onChange={e => setExpenseForm(p => ({ ...p, vendor_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Payment Method</Label>
                      <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(p => ({ ...p, payment_method: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Date</Label>
                      <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  </div>
                  <Button className="w-full" disabled={loading || !expenseForm.description || !expenseForm.amount} onClick={handleAddExpense}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add Expense
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground">Description</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">Amount</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground hidden sm:table-cell">Cost</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">Profit</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground hidden sm:table-cell">Margin</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      No transactions yet. Click "Quick Add" to log your first one.
                    </td>
                  </tr>
                )}
                {filtered.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="p-3">
                      <div className="font-medium">
                        {t.type === "income" ? t.client_name || "—" : t.vendor_name || t.description}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {t.category_name && <Badge variant="outline" className="text-xs">{t.category_name}</Badge>}
                    </td>
                    <td className={`p-3 text-right font-medium whitespace-nowrap ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount), currency)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {t.type === "income" && Number(t.cost_amount) > 0 ? formatCurrency(Number(t.cost_amount), currency) : "—"}
                    </td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      {t.type === "income" ? (
                        <span className={Number(t.profit) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {formatCurrency(Number(t.profit), currency)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right hidden sm:table-cell">
                      {t.type === "income" && Number(t.amount) > 0 ? (
                        <Badge variant={Number(t.margin) >= 25 ? "default" : Number(t.margin) >= 10 ? "secondary" : "destructive"} className="text-xs">
                          {Number(t.margin).toFixed(1)}%
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
