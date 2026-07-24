"use client";
import { useState, useEffect, useMemo } from "react";
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
import { Plus, Search, TrendingUp, TrendingDown, Loader2, DollarSign, Receipt, Filter, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@/types";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  ad_sale: "Ad Sale",
  design: "Design",
  poster_design: "Poster Design",
  video_design: "Video Design",
  company_profile: "Company Profile",
  ad_credit: "Ad Credit",
  eye_drops: "Eye Drops",
  other_income: "Other Income",
  ad_budget: "Ad Budget (USD)",
  usdt_purchase: "USDT Purchase",
  internet_bundle: "Internet/Bundle",
  fuel: "Fuel",
  food_meals: "Food/Meals",
  education: "Education/Tuition",
  family: "Family/Asher",
  designer_contractor: "Designer/Contractor",
  loan: "Loan",
  equipment: "Equipment",
  business_online: "Business/Online",
  vaccine: "Vaccine",
  other_expense: "Other Expense",
};

const BLANK_INCOME = {
  client_name: "",
  description: "",
  amount: "",
  ad_usd: "",
  category: "ad_sale",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};

const BLANK_EXPENSE = {
  description: "",
  amount: "",
  category: "ad_budget",
  vendor: "",
  payment_method: "cash",
  date: new Date().toISOString().split("T")[0],
};

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("income");
  const [incomeForm, setIncomeForm] = useState(BLANK_INCOME);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const sb = createClient();
    const { data: biz, error } = await getDefaultBusiness(sb);
    if (error || !biz) {
      toast({ title: "No business found", description: "Set up your business first.", variant: "destructive" });
      setPageLoading(false);
      return;
    }
    setBusiness(biz);
    const { data, error: txError } = await sb
      .from("transactions")
      .select("*")
      .eq("business_id", biz.id)
      .order("date", { ascending: false });
    if (txError) toast({ title: "Couldn't load transactions", description: txError.message, variant: "destructive" });
    setTransactions(data ?? []);
    setPageLoading(false);
  }

  // Auto-calculate profit preview
  const profitPreview = useMemo(() => {
    const amount = parseFloat(incomeForm.amount) || 0;
    const usd = parseFloat(incomeForm.ad_usd) || 0;
    const rate = business?.usd_exchange_rate ?? 4300;
    const adCost = usd * rate;
    const profit = amount - adCost;
    const margin = amount > 0 ? (profit / amount * 100) : 0;
    return { adCost, profit, margin };
  }, [incomeForm.amount, incomeForm.ad_usd, business]);

  // Summary stats
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === "income");
    const expenses = transactions.filter(t => t.type === "expense");
    const totalRevenue = income.reduce((s, t) => s + Number(t.amount), 0);
    const totalAdCost = income.reduce((s, t) => s + Number(t.ad_cost || 0), 0);
    const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const grossProfit = totalRevenue - totalAdCost;
    const netProfit = grossProfit - totalExpenses;
    const totalUsd = income.reduce((s, t) => s + Number(t.ad_usd || 0), 0);
    const avgMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
    return { totalRevenue, totalAdCost, totalExpenses, grossProfit, netProfit, totalUsd, avgMargin, salesCount: income.length };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (t.client_name?.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
      }
      return true;
    });
  }, [transactions, search, typeFilter]);

  async function handleAddIncome() {
    if (!incomeForm.client_name || !incomeForm.amount || !business) return;
    setLoading(true);
    const sb = createClient();
    const amount = parseFloat(incomeForm.amount);
    const adUsd = parseFloat(incomeForm.ad_usd) || 0;

    const { error } = await sb.from("transactions").insert({
      business_id: business.id,
      type: "income",
      category: incomeForm.category,
      client_name: incomeForm.client_name,
      description: incomeForm.description || `${incomeForm.client_name} - ${CATEGORY_LABELS[incomeForm.category]}`,
      amount,
      ad_usd: adUsd,
      payment_method: incomeForm.payment_method,
      date: incomeForm.date,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Transaction added", description: `${incomeForm.client_name} - ${formatCurrency(amount, business.currency)}` });
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

    const { error } = await sb.from("transactions").insert({
      business_id: business.id,
      type: "expense",
      category: expenseForm.category,
      description: expenseForm.description,
      amount,
      payment_method: expenseForm.payment_method,
      reference: expenseForm.vendor,
      date: expenseForm.date,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Expense logged", description: `${expenseForm.description} - ${formatCurrency(amount, business.currency)}` });
      setExpenseForm({ ...BLANK_EXPENSE, date: new Date().toISOString().split("T")[0] });
      setOpen(false);
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

  const currency = business?.currency ?? "MWK";

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Transactions" subtitle="Log income & expenses with profit tracking" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Revenue</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalRevenue, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.salesCount} sales</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Ad Cost</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-500/10">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats.totalAdCost, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">${stats.totalUsd.toFixed(0)} USD spent</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Gross Profit</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-xl font-bold">{formatCurrency(stats.grossProfit, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.avgMargin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Net Profit</span>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-rose-100 dark:bg-rose-500/10">
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div className={`text-xl font-bold ${stats.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatCurrency(stats.netProfit, currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">After expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search client, description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1" /> Quick Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="income">
                  <TrendingUp className="h-4 w-4 mr-1" /> Income
                </TabsTrigger>
                <TabsTrigger value="expense">
                  <TrendingDown className="h-4 w-4 mr-1" /> Expense
                </TabsTrigger>
              </TabsList>

              {/* INCOME TAB */}
              <TabsContent value="income" className="space-y-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-sm">Client Name *</Label>
                  <Input
                    placeholder="e.g. Radiant Son"
                    value={incomeForm.client_name}
                    onChange={e => setIncomeForm(p => ({ ...p, client_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Amount (MK) *</Label>
                    <Input
                      type="number"
                      placeholder="12000"
                      value={incomeForm.amount}
                      onChange={e => setIncomeForm(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Ad USD ($)</Label>
                    <Input
                      type="number"
                      placeholder="2"
                      value={incomeForm.ad_usd}
                      onChange={e => setIncomeForm(p => ({ ...p, ad_usd: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Category</Label>
                    <Select value={incomeForm.category} onValueChange={v => setIncomeForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INCOME_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Payment Method</Label>
                    <Select value={incomeForm.payment_method} onValueChange={v => setIncomeForm(p => ({ ...p, payment_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Date</Label>
                    <Input
                      type="date"
                      value={incomeForm.date}
                      onChange={e => setIncomeForm(p => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Description (optional)</Label>
                    <Input
                      placeholder="Ad ($2) + poster"
                      value={incomeForm.description}
                      onChange={e => setIncomeForm(p => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Profit Preview */}
                {incomeForm.amount && incomeForm.ad_usd && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ad Cost ({incomeForm.ad_usd} × {business?.usd_exchange_rate ?? 4300})</span>
                      <span className="font-medium">{formatCurrency(profitPreview.adCost, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(profitPreview.profit, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin</span>
                      <Badge variant={profitPreview.margin >= 25 ? "default" : profitPreview.margin >= 10 ? "secondary" : "destructive"}>
                        {profitPreview.margin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                )}

                <Button className="w-full" disabled={loading || !incomeForm.client_name || !incomeForm.amount} onClick={handleAddIncome}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Income
                </Button>
              </TabsContent>

              {/* EXPENSE TAB */}
              <TabsContent value="expense" className="space-y-3 mt-4">
                <div className="space-y-1">
                  <Label className="text-sm">Description *</Label>
                  <Input
                    placeholder="e.g. Paid to Daniel Chidike - designer"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Amount (MK) *</Label>
                    <Input
                      type="number"
                      placeholder="120000"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Vendor / Reference</Label>
                    <Input
                      placeholder="Daniel Chidike"
                      value={expenseForm.vendor}
                      onChange={e => setExpenseForm(p => ({ ...p, vendor: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Category</Label>
                    <Select value={expenseForm.category} onValueChange={v => setExpenseForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Payment Method</Label>
                    <Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(p => ({ ...p, payment_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))}
                  />
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

      {/* Transactions Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground">Client / Description</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground hidden md:table-cell">Category</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground">Amount</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground hidden sm:table-cell">Ad Cost</th>
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
                      <div className="font-medium">{t.type === "income" ? t.client_name || "—" : t.description}</div>
                      {t.description && t.type === "income" && (
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                    </td>
                    <td className={`p-3 text-right font-medium whitespace-nowrap ${t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount), currency)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {t.type === "income" && Number(t.ad_cost) > 0 ? formatCurrency(Number(t.ad_cost), currency) : "—"}
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
                        <Filter className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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
