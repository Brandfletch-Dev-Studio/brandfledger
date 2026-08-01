"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Users, FileText,
  CheckCircle2, Circle, Building2, UserPlus, Package, Zap, ArrowRight, AlertCircle,
  LineChart as LineChartIcon, Plus, Download, Bell, ShoppingCart, ArrowLeftRight
} from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PeriodSelect } from "./period-select";
import { LiveBadge } from "@/components/ui/live-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/utils";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface SetupStatus { hasBusiness: boolean; hasCustomer: boolean; hasProduct: boolean; hasInvoice: boolean; }

interface Transaction {
  id: string;
  client_name: string | null;
  description: string;
  amount: number;
  cost_amount: number;
  profit: number;
  margin: number;
  date: string;
  type: "income" | "expense";
  category_name?: string;
  vendor_name?: string;
}

type Granularity = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  business: { name: string; currency: string; id?: string; usd_exchange_rate?: number } | null;
  stats: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    netProfit: number;
    outstandingAmount: number;
    outstandingCount: number;
    customerCount: number;
    salesCount: number;
  } | null;
  allTransactions?: Transaction[];
  recentInvoices?: { id: string; total: number; status: string; created_at: string; invoice_number: string }[];
  recentIncome?: Transaction[];
  topCustomers?: { name: string; total: number; invoiceCount: number }[];
  setupStatus: SetupStatus;
  period?: string;
}

function computeTrendData(transactions: Transaction[], granularity: Granularity) {
  const now = new Date();
  const dataMap: Record<string, { label: string; revenue: number; expenses: number; profit: number; sortKey: string }> = {};

  function getBuckets(date: Date): { key: string; label: string; sortKey: string } {
    const d = new Date(date);
    if (granularity === "daily") {
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { key, label, sortKey: key };
    } else if (granularity === "weekly") {
      const monday = new Date(d);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      const key = monday.toISOString().slice(0, 10);
      const label = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { key, label, sortKey: key };
    } else if (granularity === "monthly") {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { key, label, sortKey: key };
    } else {
      const key = `${d.getFullYear()}`;
      const label = `${d.getFullYear()}`;
      return { key, label, sortKey: key };
    }
  }

  // Determine the date range to pre-fill
  let rangeStart: Date;
  if (granularity === "daily") {
    rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 29); // last 30 days
  } else if (granularity === "weekly") {
    rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 83); // last 12 weeks
  } else if (granularity === "monthly") {
    rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1); // last 12 months
  } else {
    rangeStart = new Date(2000, 0, 1); // all years
  }

  // Pre-fill buckets
  if (granularity === "daily") {
    for (let i = 0; i < 30; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const { key, label, sortKey } = getBuckets(d);
      if (!dataMap[key]) dataMap[key] = { label, revenue: 0, expenses: 0, profit: 0, sortKey };
    }
  } else if (granularity === "weekly") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i * 7);
      const { key, label, sortKey } = getBuckets(d);
      if (!dataMap[key]) dataMap[key] = { label, revenue: 0, expenses: 0, profit: 0, sortKey };
    }
  } else if (granularity === "monthly") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
      const { key, label, sortKey } = getBuckets(d);
      if (!dataMap[key]) dataMap[key] = { label, revenue: 0, expenses: 0, profit: 0, sortKey };
    }
  } else {
    // yearly — pre-fill from first transaction to now
    if (transactions.length > 0) {
      const earliest = transactions.reduce((min, t) => {
        const d = new Date(t.date);
        return d < min ? d : min;
      }, new Date());
      for (let y = earliest.getFullYear(); y <= now.getFullYear(); y++) {
        const key = `${y}`;
        if (!dataMap[key]) dataMap[key] = { label: `${y}`, revenue: 0, expenses: 0, profit: 0, sortKey: key };
      }
    }
  }

  // Aggregate transactions
  for (const tx of transactions) {
    if (!tx.date) continue;
    const txDate = new Date(tx.date);
    if (txDate < rangeStart && granularity !== "yearly") continue;
    const { key, label, sortKey } = getBuckets(txDate);
    if (!dataMap[key]) dataMap[key] = { label, revenue: 0, expenses: 0, profit: 0, sortKey };
    const amount = Number(tx.amount || 0);
    if (tx.type === "income") {
      dataMap[key].revenue += amount;
      dataMap[key].expenses += Number(tx.cost_amount || 0);
    } else if (tx.type === "expense") {
      dataMap[key].expenses += amount;
    }
  }

  // Compute profit and sort
  return Object.values(dataMap)
    .map(d => ({ ...d, profit: d.revenue - d.expenses }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function StatCard({ label, value, fullValue, sub, valueClassName }: { label: string; value: string; fullValue?: string; sub?: string; valueClassName?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </div>
        <div
          className={`text-lg sm:text-xl font-bold tracking-tight leading-tight ${valueClassName || "text-foreground"}`}
          title={fullValue}
        >
          {value}
        </div>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SetupChecklist({ initialStatus }: { initialStatus: SetupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const completedCount = [status.hasBusiness, status.hasCustomer, status.hasProduct, status.hasInvoice].filter(Boolean).length;
  const allDone = completedCount === 4;
  if (allDone) return null;

  const steps = [
    { id: "business", label: "Set up your business", icon: Building2, done: status.hasBusiness, href: "/settings" },
    { id: "customer", label: "Add your first customer", icon: UserPlus, done: status.hasCustomer, href: "/customers" },
    { id: "product", label: "Add a product or service", icon: Package, done: status.hasProduct, href: "/products" },
    { id: "invoice", label: "Create your first invoice", icon: FileText, done: status.hasInvoice, href: "/invoices/create" },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">Get started</CardTitle>
            <CardDescription>{completedCount} of 4 steps complete</CardDescription>
          </div>
          <Progress value={(completedCount / 4) * 100} className="w-24 h-2 shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className={`rounded-lg border bg-card overflow-hidden transition-opacity ${step.done ? "opacity-60" : "shadow-sm"}`}>
            {step.done ? (
              <div className="flex items-center gap-3 p-3 cursor-default">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm font-medium flex-1 line-through text-muted-foreground">{step.label}</span>
              </div>
            ) : (
              <Link href={step.href ?? "#"} className="flex items-center gap-3 p-3 w-full text-left">
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">{step.label}</span>
                <span className="text-xs text-primary flex items-center gap-1 font-medium">Go <ArrowRight className="h-3 w-3" /></span>
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardClient({
  business,
  stats,
  allTransactions = [],
  recentInvoices = [],
  recentIncome = [],
  topCustomers = [],
  setupStatus,
  period = "this_month",
}: Props) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Live refresh — polls router.refresh() every 30s while tab is visible
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let lastRefresh = 0;

    const doRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh < 5000) return; // debounce
      lastRefresh = now;
      router.refresh();
      setLastUpdated(new Date());
    };

    const start = () => {
      timer = setInterval(doRefresh, 30000);
      setIsLive(true);
    };

    const stop = () => {
      clearInterval(timer);
      setIsLive(false);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        doRefresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  if (!business) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div className="p-6 max-w-xl">
          <SetupChecklist initialStatus={setupStatus} />
        </div>
      </div>
    );
  }

  const fmt = (v: number) => formatCurrency(v, business.currency);

  const trendData = useMemo(() => computeTrendData(allTransactions, granularity), [allTransactions, granularity]);
  const hasTrendData = trendData.length > 0 && trendData.some(d => d.revenue > 0 || d.expenses > 0);

  const marginPercent = stats && stats.totalRevenue > 0 ? (stats.grossProfit / stats.totalRevenue) * 100 : 0;
  const isNetProfitPositive = (stats?.netProfit || 0) >= 0;

  const granularityLabels: Record<Granularity, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };

  return (
    <div className="relative min-h-full p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mt-1">
            {business.name}
          </p>
        </div>
        <PeriodSelect value={period} />
      </div>

      {/* Quick action pills */}
      <LiveBadge isLive={isLive} lastUpdated={lastUpdated} />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Link href="/transactions?new=1" className="shrink-0">
          <Button size="sm" className="rounded-full"><Plus className="h-3.5 w-3.5 mr-1.5" />New Invoice</Button>
        </Link>
        <Link href="/transactions" className="shrink-0">
          <Button size="sm" variant="outline" className="rounded-full bg-card"><ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />Log Transaction</Button>
        </Link>
        <Link href="/customers" className="shrink-0">
          <Button size="sm" variant="outline" className="rounded-full bg-card"><UserPlus className="h-3.5 w-3.5 mr-1.5" />Add Customer</Button>
        </Link>
        <Link href="/reports" className="shrink-0">
          <Button size="sm" variant="outline" className="rounded-full bg-card"><Download className="h-3.5 w-3.5 mr-1.5" />Export Report</Button>
        </Link>
      </div>

      {/* Setup Checklist */}
      {(!setupStatus.hasCustomer || !setupStatus.hasProduct || !setupStatus.hasInvoice) && (
        <div className="mb-6">
          <SetupChecklist initialStatus={setupStatus} />
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Revenue" value={fmt(stats.totalRevenue)} fullValue={formatCurrencyFull(stats.totalRevenue, business.currency)}
            sub={`${stats.salesCount} sale${stats.salesCount !== 1 ? "s" : ""}`} valueClassName="text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Cost of Sales" value={fmt(stats.totalCost)} fullValue={formatCurrencyFull(stats.totalCost, business.currency)}
            sub="From products sold" valueClassName="text-rose-600 dark:text-rose-400" />
          <StatCard label="Gross Profit" value={fmt(stats.grossProfit)} fullValue={formatCurrencyFull(stats.grossProfit, business.currency)}
            sub={`${marginPercent.toFixed(1)}% margin`} valueClassName="text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Net Profit" value={fmt(stats.netProfit)} fullValue={formatCurrencyFull(stats.netProfit, business.currency)}
            sub={`${stats.totalRevenue > 0 ? ((stats.netProfit / stats.totalRevenue) * 100).toFixed(1) : 0}% margin`}
            valueClassName={isNetProfitPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} />
        </div>
      )}

      {/* Two Column Layout: Left Chart, Right Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Trend Chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <SelectTrigger className="w-auto min-w-[100px] h-8 rounded-full bg-card border text-xs font-medium shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="z-50 min-w-[140px] rounded-xl border bg-card shadow-lg">
                <SelectItem value="daily" className="text-sm rounded-lg cursor-pointer">Daily (30d)</SelectItem>
                <SelectItem value="weekly" className="text-sm rounded-lg cursor-pointer">Weekly (12w)</SelectItem>
                <SelectItem value="monthly" className="text-sm rounded-lg cursor-pointer">Monthly (12m)</SelectItem>
                <SelectItem value="yearly" className="text-sm rounded-lg cursor-pointer">Yearly (all)</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent suppressHydrationWarning>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 5 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    interval={granularity === "daily" ? 5 : "preserveStartEnd"} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} width={72} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" name="Revenue" dot={false} />
                  <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" name="Expenses" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <LineChartIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Not enough data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your trend will fill in as transactions come in</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Activity */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentIncome || recentIncome.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <Link href="/transactions" className="mt-3">
                  <Button size="sm" variant="outline">Log Transaction</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentIncome.slice(0, 10).map((tx) => {
                  const isIncome = tx.type === "income";
                  return (
                    <div key={tx.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.client_name || tx.description || "Direct Client"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(tx.date)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Badge variant="outline" className={
                          isIncome
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                        }>
                          {isIncome ? "+" : "-"}{fmt(tx.amount)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Action Button */}
      <Link href="/transactions?new=1"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-20 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="New Invoice">
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
