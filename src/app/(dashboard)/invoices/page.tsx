"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Loader2, RefreshCw, Send, CheckCircle, Clock, AlertCircle, Copy } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", icon: Send, className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  paid: { label: "Paid", icon: CheckCircle, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  overdue: { label: "Overdue", icon: AlertCircle, className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setPageLoading(true);
    try {
      const res = await fetch("/api/data/invoices");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      setInvoices(data.invoices ?? []);
      setCustomers(data.customers ?? []);
    } catch (err: any) {
      toast({ title: "Couldn't load invoices", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const customerMap = useMemo(() => {
    const m: Record<string, any> = {};
    customers.forEach((c: any) => { m[c.id] = c; });
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    return invoices.filter((inv: any) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const custName = inv.customer_name || customerMap[inv.customer_id]?.name || "";
        return inv.invoice_number?.toLowerCase().includes(q) || custName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [invoices, search, statusFilter, customerMap]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i: any) => i.status === "paid");
    const outstanding = invoices.filter((i: any) => i.status === "sent" || i.status === "overdue");
    const overdue = invoices.filter((i: any) => i.status === "overdue");
    return {
      totalPaid: paid.reduce((s: number, i: any) => s + Number(i.total), 0),
      outstanding: outstanding.reduce((s: number, i: any) => s + Number(i.total), 0),
      overdueCount: overdue.length,
      totalCount: invoices.length,
    };
  }, [invoices]);

  async function markAsPaid(inv: any) {
    setActionLoading(inv.id);
    try {
      const res = await fetch("/api/data/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast({ title: "Marked as paid", description: inv.invoice_number });
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function copyShareLink(inv: any) {
    const url = `${window.location.origin}/invoices/view/${inv.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share this link with your client" });
    } catch {
      toast({ title: "Link", description: url });
    }
  }

  const currency = business?.currency ?? "MWK";

  if (pageLoading) return (
    <div>
      <Header title="Invoices" description="Create and share professional invoices" icon={FileText} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Invoices" description="Create and share professional invoices" icon={FileText}
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Button size="sm" onClick={() => router.push("/invoices/create")}>
              <Plus className="mr-1.5 h-4 w-4" />Create
            </Button>
          </div>
        }
      />
      <div className="p-3 sm:p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-card p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-sm sm:text-lg font-bold">{stats.totalCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid</p>
            <p className="text-sm sm:text-lg font-bold text-emerald-600">{formatCurrency(stats.totalPaid, currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding</p>
            <p className="text-sm sm:text-lg font-bold text-amber-600">{formatCurrency(stats.outstanding, currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-2.5 sm:p-3">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue</p>
            <p className="text-sm sm:text-lg font-bold text-rose-600">{stats.overdueCount}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice # or client..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoice list */}
        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search || statusFilter !== "all" ? "No invoices match your filters." : "No invoices yet. Create your first one!"}</p>
            {!search && statusFilter === "all" && (
              <Button size="sm" onClick={() => router.push("/invoices/create")}>
                <Plus className="mr-1.5 h-4 w-4" />Create Invoice
              </Button>
            )}
          </CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:gap-3">
            {filtered.map((inv: any) => {
              const custName = inv.customer_name || customerMap[inv.customer_id]?.name || "Unknown client";
              const status = statusConfig[inv.status] ?? statusConfig.draft;
              const StatusIcon = status.icon;
              return (
                <Card key={inv.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                  <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <StatusIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{inv.invoice_number}</p>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {custName} · {formatDate(inv.issue_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(Number(inv.total), currency)}</p>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {inv.status !== "paid" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={actionLoading === inv.id} onClick={() => markAsPaid(inv)}>
                            {actionLoading === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark Paid"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copyShareLink(inv)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
