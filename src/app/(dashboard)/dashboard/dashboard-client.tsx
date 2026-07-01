
"use client";
import { useState } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Users, FileText,
  CheckCircle2, Circle, Building2, UserPlus, Package, Zap,
  ChevronDown, ChevronUp, Loader2, ArrowRight, AlertCircle,
  BarChart3, Plus,
} from "lucide-react";
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

interface SetupStatus { hasBusiness: boolean; hasCustomer: boolean; hasProduct: boolean; hasInvoice: boolean; }

interface Props {
  business: { name: string; currency: string; id?: string } | null;
  stats: { revenue: number; expenses: number; profit: number; outstandingAmount: number; outstandingCount: number; customerCount: number; } | null;
  recentInvoices?: { id: string; total: number; status: string; created_at: string; invoice_number: string }[];
  setupStatus: SetupStatus;
}

const statusBadge: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
};

function StatCard({ label, value, sub, icon: Icon, trend }: { label: string; value: string; sub?: string; icon: React.ElementType; trend?: "up" | "down" | "neutral" }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className={`text-2xl font-bold ${trend === "down" ? "text-destructive" : trend === "up" ? "text-green-600" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
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
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Get started</CardTitle>
            <CardDescription>{completedCount} of 4 steps complete</CardDescription>
          </div>
          <Progress value={(completedCount / 4) * 100} className="w-24 h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className={`rounded-lg border bg-card overflow-hidden ${step.done ? "opacity-60" : ""}`}>
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

export default function DashboardClient({ business, stats, recentInvoices = [], setupStatus }: Props) {
  if (!business || !stats) {
    return (
      <div>
        <div className="border-b bg-card px-6 py-4 md:pl-6 pl-16">
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div className="p-6 max-w-xl">
          <SetupChecklist initialStatus={setupStatus} />
        </div>
      </div>
    );
  }

  const fmt = (v: number) => formatCurrency(v, business.currency);

  return (
    <div className="relative min-h-full">
      <div className="border-b bg-card px-6 py-4 md:pl-6 pl-16 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{business.name}</h1>
          <p className="text-sm text-muted-foreground">Financial overview</p>
        </div>
        <Link href="/reports" className="shrink-0">
          <Button size="icon" variant="ghost" className="rounded-full text-muted-foreground" aria-label="Reports">
            <BarChart3 className="h-5 w-5" />
          </Button>
        </Link>
      </div>
      <div className="p-6 space-y-6">
        {/* Setup checklist if not complete */}
        {(!setupStatus.hasCustomer || !setupStatus.hasProduct || !setupStatus.hasInvoice) && (
          <SetupChecklist initialStatus={setupStatus} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmt(stats.revenue)} sub="From paid invoices" icon={TrendingUp} trend="up" />
          <StatCard label="Total Expenses" value={fmt(stats.expenses)} icon={TrendingDown} trend="down" />
          <StatCard label="Net Profit" value={fmt(stats.profit)} icon={DollarSign} trend={stats.profit >= 0 ? "up" : "down"} />
          <StatCard label="Outstanding" value={fmt(stats.outstandingAmount)} sub={`${stats.outstandingCount} invoice${stats.outstandingCount !== 1 ? "s" : ""}`} icon={Clock} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent invoices */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <Link href="/invoices" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </CardHeader>
            <CardContent>
              {recentInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices yet</p>
                  <Link href="/invoices" className="mt-2"><Button size="sm" variant="outline">Create your first invoice</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">#{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{fmt(inv.total)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge[inv.status] ?? ""}`}>{inv.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/invoices", label: "New Invoice", icon: FileText },
                { href: "/customers", label: "Add Customer", icon: Users },
                { href: "/expenses", label: "Log Expense", icon: TrendingDown },
                { href: "/reports", label: "View Reports", icon: BarChart3 },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
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

