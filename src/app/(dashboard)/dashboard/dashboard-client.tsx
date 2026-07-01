
"use client";
import { useState } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Users, FileText,
  CheckCircle2, Circle, Building2, UserPlus, Package, Zap,
  ChevronDown, ChevronUp, Loader2, ArrowRight, AlertCircle,
  BarChart3, Plus, Download, Bell, ShoppingCart,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PeriodSelect } from "./period-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "MWK", "ZAR", "NGN", "KES", "GHS"];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface SetupStatus { hasBusiness: boolean; hasCustomer: boolean; hasProduct: boolean; hasInvoice: boolean; }

interface Props {
  business: { name: string; currency: string; id?: string } | null;
  stats: { revenue: number; expenses: number; profit: number; outstandingAmount: number; outstandingCount: number; customerCount: number; totalSalesCount: number; totalSalesAmount: number; } | null;
  recentInvoices?: { id: string; total: number; status: string; created_at: string; invoice_number: string }[];
  monthlyTrend?: { month: string; revenue: number; expenses: number }[];
  topCustomers?: { name: string; total: number; invoiceCount: number }[];
  setupStatus: SetupStatus;
  period?: string;
}

const statusBadge: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

const statusDot: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  sent: "bg-blue-500",
  paid: "bg-emerald-500",
  overdue: "bg-rose-500",
};

// Colored pill for an invoice's amount, echoing how transaction feeds show +/- amounts
const amountPill: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
};

const statTones = {
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", value: "text-emerald-600 dark:text-emerald-400" },
  rose: { bg: "bg-rose-100 dark:bg-rose-500/10", icon: "text-rose-600 dark:text-rose-400", value: "text-rose-600 dark:text-rose-400" },
  primary: { bg: "bg-primary/10", icon: "text-primary", value: "text-foreground" },
  amber: { bg: "bg-amber-100 dark:bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", value: "text-foreground" },
} as const;

function StatCard({ label, value, sub, icon: Icon, tone = "primary" }: { label: string; value: string; sub?: string; icon: React.ElementType; tone?: keyof typeof statTones }) {
  const t = statTones[tone];
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${t.bg}`}>
            <Icon className={`h-4 w-4 ${t.icon}`} />
          </div>
        </div>
        <div className={`text-2xl font-bold tracking-tight truncate ${t.value}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SetupChecklist({ initialStatus }: { initialStatus: SetupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [expanded, setExpanded] = useState<string | null>(!initialStatus.hasBusiness ? "business" : !initialStatus.hasCustomer ? "customer" : !initialStatus.hasProduct ? "product" : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bizForm, setBizForm] = useState({ name: "", email: "", currency: "USD", invoice_prefix: "INV" });
  const [custForm, setCustForm] = useState({ name: "", email: "", phone: "" });
  const [prodForm, setProdForm] = useState({ name: "", price: "", category: "" });

  const completedCount = [status.hasBusiness, status.hasCustomer, status.hasProduct, status.hasInvoice].filter(Boolean).length;
  const allDone = completedCount === 4;
  if (allDone) return null;

  const steps = [
    { id: "business", label: "Set up your business", icon: Building2, done: status.hasBusiness },
    { id: "customer", label: "Add your first customer", icon: UserPlus, done: status.hasCustomer },
    { id: "product", label: "Add a product or service", icon: Package, done: status.hasProduct },
    { id: "invoice", label: "Create your first invoice", icon: FileText, done: status.hasInvoice, href: "/invoices" },
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
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => !step.done && !step.href && setExpanded(expanded === step.id ? null : step.id)}
            >
              {step.done ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
              <span className={`text-sm font-medium flex-1 ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.label}</span>
              {!step.done && step.href ? (
                <Link href={step.href} className="text-xs text-primary hover:underline flex items-center gap-1">Go <ArrowRight className="h-3 w-3" /></Link>
              ) : !step.done && (
                expanded === step.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {!step.done && expanded === step.id && step.id === "business" && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3">
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Business name *</Label><Input className="h-8 text-sm" placeholder="Acme Ltd" value={bizForm.name} onChange={e => setBizForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Invoice prefix</Label><Input className="h-8 text-sm" placeholder="INV" value={bizForm.invoice_prefix} onChange={e => setBizForm(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Currency</Label><Select value={bizForm.currency} onValueChange={v => setBizForm(p => ({ ...p, currency: v }))}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <Button size="sm" disabled={loading || !bizForm.name} onClick={async () => {
                  setLoading(true); setError("");
                  try {
                    const res = await fetch("/api/onboarding", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ step: "business", data: bizForm }),
                    });
                    const json = await res.json();
                    if (!res.ok) { setError(json.error ?? "Something went wrong"); setLoading(false); return; }
                    setStatus(s => ({ ...s, hasBusiness: true })); setExpanded("customer"); setLoading(false); router.refresh();
                  } catch {
                    setError("Something went wrong. Please try again."); setLoading(false);
                  }
                }}>{loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Save business</Button>
              </div>
            )}
            {!step.done && expanded === step.id && step.id === "customer" && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3">
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Name *</Label><Input className="h-8 text-sm" placeholder="Jane Smith" value={custForm.name} onChange={e => setCustForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input className="h-8 text-sm" type="email" value={custForm.email} onChange={e => setCustForm(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Phone</Label><Input className="h-8 text-sm" value={custForm.phone} onChange={e => setCustForm(p => ({ ...p, phone: e.target.value }))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={loading || !custForm.name} onClick={async () => {
                    setLoading(true); setError("");
                    try {
                      const res = await fetch("/api/onboarding", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ step: "customer", data: custForm }),
                      });
                      const json = await res.json();
                      if (!res.ok) { setError(json.error ?? "Something went wrong"); setLoading(false); return; }
                      setStatus(s => ({ ...s, hasCustomer: true })); setExpanded("product"); setLoading(false);
                    } catch {
                      setError("Something went wrong. Please try again."); setLoading(false);
                    }
                  }}>{loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Add customer</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setError(""); setStatus(s => ({ ...s, hasCustomer: true })); setExpanded("product"); }}>Skip</Button>
                </div>
              </div>
            )}
            {!step.done && expanded === step.id && step.id === "product" && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3">
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Name *</Label><Input className="h-8 text-sm" placeholder="Web design" value={prodForm.name} onChange={e => setProdForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Price</Label><Input className="h-8 text-sm" type="number" value={prodForm.price} onChange={e => setProdForm(p => ({ ...p, price: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Category</Label><Input className="h-8 text-sm" placeholder="Services" value={prodForm.category} onChange={e => setProdForm(p => ({ ...p, category: e.target.value }))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={loading || !prodForm.name} onClick={async () => {
                    setLoading(true); setError("");
                    try {
                      const res = await fetch("/api/onboarding", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ step: "product", data: prodForm }),
                      });
                      const json = await res.json();
                      if (!res.ok) { setError(json.error ?? "Something went wrong"); setLoading(false); return; }
                      setStatus(s => ({ ...s, hasProduct: true })); setExpanded(null); setLoading(false);
                    } catch {
                      setError("Something went wrong. Please try again."); setLoading(false);
                    }
                  }}>{loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Add product</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setError(""); setStatus(s => ({ ...s, hasProduct: true })); setExpanded(null); }}>Skip</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardClient({ business, stats, recentInvoices = [], monthlyTrend = [], topCustomers = [], setupStatus, period = "this_month" }: Props) {
  if (!business || !stats) {
    return (
      <div>
        <div className="border-b bg-card px-4 sm:px-6 py-4">
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div className="p-6 max-w-xl">
          <SetupChecklist initialStatus={setupStatus} />
        </div>
      </div>
    );
  }

  const fmt = (v: number) => formatCurrency(v, business.currency);
  const hasTrendData = monthlyTrend.some(m => m.revenue > 0 || m.expenses > 0);

  return (
    <div className="relative min-h-full">
      <div className="relative border-b bg-gradient-to-r from-primary/5 via-card to-card px-4 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{business.name}</p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
              {getGreeting()}, here&apos;s an overview of your account
            </p>
          </div>
          <PeriodSelect value={period} />
        </div>

        {/* Quick action pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
          <Link href="/invoices?new=1" className="shrink-0">
            <Button size="sm" className="rounded-full"><Plus className="h-3.5 w-3.5 mr-1.5" />New Invoice</Button>
          </Link>
          <Link href="/customers" className="shrink-0">
            <Button size="sm" variant="outline" className="rounded-full bg-card"><UserPlus className="h-3.5 w-3.5 mr-1.5" />Add Customer</Button>
          </Link>
          <Link href="/reports" className="shrink-0">
            <Button size="sm" variant="outline" className="rounded-full bg-card"><Download className="h-3.5 w-3.5 mr-1.5" />Export Report</Button>
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Setup checklist if not complete */}
        {(!setupStatus.hasCustomer || !setupStatus.hasProduct || !setupStatus.hasInvoice) && (
          <SetupChecklist initialStatus={setupStatus} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Revenue" value={fmt(stats.revenue)} icon={TrendingUp} tone="emerald" />
          <StatCard label="Expenses" value={fmt(stats.expenses)} icon={TrendingDown} tone="rose" />
          <StatCard label="Net Profit" value={fmt(stats.profit)} icon={DollarSign} tone={stats.profit >= 0 ? "emerald" : "rose"} />
          <StatCard label="Total Sales" value={String(stats.totalSalesCount)} sub={`${fmt(stats.totalSalesAmount)} invoiced`} icon={ShoppingCart} tone="primary" />
        </div>

        {/* Outstanding reminder — only shown when it's actually relevant */}
        {stats.outstandingCount > 0 && (
          <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-500/5 dark:border-amber-500/20 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {stats.outstandingCount} invoice{stats.outstandingCount !== 1 ? "s" : ""} awaiting payment
                </p>
                <p className="text-xs text-muted-foreground">{fmt(stats.outstandingAmount)} outstanding — follow up to get paid faster</p>
              </div>
              <Link href="/invoices" className="shrink-0">
                <Button size="sm" variant="outline" className="bg-card">View</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly trend chart */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Monthly Trend</CardTitle>
                <CardDescription className="text-xs mt-0.5">Revenue vs expenses, last 6 months</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Expenses</span>
              </div>
            </CardHeader>
            <CardContent>
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyTrend} margin={{ left: -20, right: 8 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expensesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-40" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={0} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueFill)" />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#fb7185" strokeWidth={2} fill="url(#expensesFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Not enough data yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Your trend will fill in as invoices and expenses come in</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top customers */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Top Customers</CardTitle>
              <Link href="/customers" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">No billed customers yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {topCustomers.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-sm font-semibold shrink-0">{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent invoices */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <Link href="/invoices" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </CardHeader>
            <CardContent>
              {recentInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">No invoices yet</p>
                  <Link href="/invoices?new=1" className="mt-3"><Button size="sm" variant="outline">Create your first invoice</Button></Link>
                </div>
              ) : (
                <div className="-mx-2">
                  {recentInvoices.map(inv => (
                    <Link
                      key={inv.id}
                      href="/invoices"
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 border-b last:border-0 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot[inv.status] ?? "bg-muted-foreground/40"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">#{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground capitalize">{inv.status} · {formatDate(inv.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full shrink-0 ${amountPill[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                        {inv.status === "paid" ? "+" : ""}{fmt(inv.total)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { href: "/invoices?new=1", label: "New Invoice", icon: FileText, tone: "primary" as const },
                { href: "/customers", label: "Add Customer", icon: Users, tone: "emerald" as const },
                { href: "/expenses", label: "Log Expense", icon: TrendingDown, tone: "rose" as const },
                { href: "/reports", label: "View Reports", icon: BarChart3, tone: "amber" as const },
              ].map(({ href, label, icon: Icon, tone }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${statTones[tone].bg}`}>
                    <Icon className={`h-4 w-4 ${statTones[tone].icon}`} />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Link
        href="/invoices?new=1"
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="New Invoice"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
