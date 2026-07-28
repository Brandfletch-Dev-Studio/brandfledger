"use client";
import { useState } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Users, FileText,
  CheckCircle2, Circle, Building2, UserPlus, Package, Zap, ArrowRight, AlertCircle,
  BarChart3, Plus, Download, Bell, ShoppingCart, ArrowLeftRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PeriodSelect } from "./period-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/utils";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "MWK", "ZAR", "NGN", "KES", "GHS"];

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
  } | null;
  recentInvoices?: { id: string; total: number; status: string; created_at: string; invoice_number: string }[];
  recentIncome?: Transaction[];
  monthlyTrend?: { month: string; revenue: number; expenses: number; profit: number }[];
  topCustomers?: { name: string; total: number; invoiceCount: number }[];
  setupStatus: SetupStatus;
  period?: string;
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
  recentInvoices = [],
  recentIncome = [],
  monthlyTrend = [],
  topCustomers = [],
  setupStatus,
  period = "this_month",
}: Props) {
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
  const hasTrendData = monthlyTrend.length > 0 && monthlyTrend.some(m => m.revenue > 0 || m.expenses > 0);

  const marginPercent = stats && stats.totalRevenue > 0 ? (stats.grossProfit / stats.totalRevenue) * 100 : 0;
  const isNetProfitPositive = (stats?.netProfit || 0) >= 0;

  return (
    <div className="relative min-h-full p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header Area */}
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

      {/* Setup Checklist (above stat cards if incomplete) */}
      {(!setupStatus.hasCustomer || !setupStatus.hasProduct || !setupStatus.hasInvoice) && (
        <div className="mb-6">
          <SetupChecklist initialStatus={setupStatus} />
        </div>
      )}

      {/* Stats Cards Row (2 cols mobile, 4 cols desktop) */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Revenue"
            value={fmt(stats.totalRevenue)}
            fullValue={formatCurrencyFull(stats.totalRevenue, business.currency)}
            sub={`${recentIncome.length} sale${recentIncome.length !== 1 ? "s" : ""}`}
            valueClassName="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Cost of Sales"
            value={fmt(stats.totalCost)}
            fullValue={formatCurrencyFull(stats.totalCost, business.currency)}
            sub="From products sold"
            valueClassName="text-rose-600 dark:text-rose-400"
          />
          <StatCard
            label="Gross Profit"
            value={fmt(stats.grossProfit)}
            fullValue={formatCurrencyFull(stats.grossProfit, business.currency)}
            sub={`${marginPercent.toFixed(1)}% margin`}
            valueClassName="text-indigo-600 dark:text-indigo-400"
          />
          <StatCard
            label="Net Profit"
            value={fmt(stats.netProfit)}
            fullValue={formatCurrencyFull(stats.netProfit, business.currency)}
            sub="After expenses"
            valueClassName={isNetProfitPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
          />
        </div>
      )}

      {/* Two Column Layout: Left Chart, Right Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Bar Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent suppressHydrationWarning>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyTrend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-40" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-3" />
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
                {recentIncome.slice(0, 6).map((tx) => {
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
                        <Badge
                          variant="outline"
                          className={
                            isIncome
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                          }
                        >
                          {isIncome ? "+" : "-"}
                          {fmt(tx.amount)}
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
      <Link
        href="/transactions?new=1"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-20 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="New Invoice"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
