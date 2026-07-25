"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, FileText, Loader2, RefreshCw, Send, CheckCircle,
  AlertCircle, MoreVertical, Eye, Trash2, Copy, MessageCircle, Download,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  draft:   { label: "Draft",   icon: FileText,     className: "bg-muted text-muted-foreground" },
  sent:    { label: "Sent",    icon: Send,         className: "bg-blue-100 text-blue-700" },
  paid:    { label: "Paid",    icon: CheckCircle,  className: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", icon: AlertCircle,  className: "bg-rose-100 text-rose-700" },
};

// ── Action menu ───────────────────────────────────────────────────────────────
function ActionMenu({
  inv, currency, onMarkPaid, onDelete, onCopyLink, onWhatsApp,
  loading,
}: {
  inv: any; currency: string;
  onMarkPaid: () => void; onDelete: () => void;
  onCopyLink: () => void; onWhatsApp: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function act(fn: () => void) { setOpen(false); fn(); }

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-48 rounded-xl border bg-white shadow-xl z-50 overflow-hidden py-1">
          <MenuItem icon={Eye} label="View invoice" onClick={() => act(() => router.push(`/invoices/${inv.id}`))} />
          <MenuItem icon={Copy} label="Copy share link" onClick={() => act(onCopyLink)} />
          <MenuItem icon={MessageCircle} label="Share on WhatsApp" onClick={() => act(onWhatsApp)} color="text-green-600" />
          <MenuItem icon={Download} label="Download PDF" onClick={() => act(() => window.open(`/invoices/view/${inv.id}?print=1`, "_blank"))} />
          {inv.status !== "paid" && (
            <MenuItem icon={CheckCircle} label="Mark as paid" onClick={() => act(onMarkPaid)} color="text-emerald-600" />
          )}
          <div className="my-1 border-t" />
          <MenuItem icon={Trash2} label="Delete" onClick={() => act(onDelete)} color="text-rose-600" />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, color = "text-foreground" }: {
  icon: any; label: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-muted transition-colors ${color}`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
    if (isRefresh) setRefreshing(true); else setPageLoading(true);
    try {
      const res = await fetch("/api/data/invoices");
      if (!res.ok) throw new Error("Failed");
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
    customers.forEach(c => { m[c.id] = c; });
    return m;
  }, [customers]);

  const filtered = useMemo(() => invoices.filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = inv.customer_name || customerMap[inv.customer_id]?.name || "";
      return inv.invoice_number?.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    }
    return true;
  }), [invoices, search, statusFilter, customerMap]);

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === "paid");
    const outstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue");
    return {
      totalPaid: paid.reduce((s, i) => s + Number(i.total), 0),
      outstanding: outstanding.reduce((s, i) => s + Number(i.total), 0),
      overdueCount: invoices.filter(i => i.status === "overdue").length,
      totalCount: invoices.length,
    };
  }, [invoices]);

  const currency = business?.currency ?? "MWK";

  async function markAsPaid(inv: any) {
    setActionLoading(inv.id);
    try {
      const res = await fetch("/api/data/invoices", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Marked as paid", description: inv.invoice_number });
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function deleteInvoice(inv: any) {
    if (!confirm(`Delete ${inv.invoice_number}? This cannot be undone.`)) return;
    setActionLoading(inv.id);
    try {
      const res = await fetch(`/api/data/invoices?id=${inv.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Invoice deleted" });
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  function copyLink(inv: any) {
    const url = `${window.location.origin}/invoices/view/${inv.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast({ title: "Link copied" });
  }

  function shareWhatsApp(inv: any) {
    const url = `${window.location.origin}/invoices/view/${inv.id}`;
    const custName = inv.customer_name || customerMap[inv.customer_id]?.name || "";
    const total = formatCurrency(Number(inv.total), currency);
    const phone = (customerMap[inv.customer_id]?.phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hi ${custName}! Here is your invoice ${inv.invoice_number} from ${business?.name || "us"} for ${total}.\n\nView: ${url}`
    );
    window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
  }

  if (pageLoading) return (
    <div>
      <Header title="Invoices" description="Create and share professional invoices" icon={FileText} />
      <div className="flex items-center justify-center py-32">
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
        {/* Stats — 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total", value: stats.totalCount, cls: "text-foreground" },
            { label: "Paid", value: formatCurrency(stats.totalPaid, currency), cls: "text-emerald-600" },
            { label: "Outstanding", value: formatCurrency(stats.outstanding, currency), cls: "text-amber-600" },
            { label: "Overdue", value: stats.overdueCount, cls: "text-rose-600" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border bg-card p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-base font-bold mt-0.5 ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoice # or client…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {search || statusFilter !== "all" ? "No invoices match your filters." : "No invoices yet. Create your first one!"}
            </p>
            {!search && statusFilter === "all" && (
              <Button size="sm" onClick={() => router.push("/invoices/create")}>
                <Plus className="mr-1.5 h-4 w-4" />Create Invoice
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inv => {
              const custName = inv.customer_name || customerMap[inv.customer_id]?.name || "Unknown client";
              const sc = statusConfig[inv.status] ?? statusConfig.draft;
              return (
                <div
                  key={inv.id}
                  className="rounded-xl border bg-card flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:shadow-md transition-shadow active:opacity-80"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  {/* Status dot */}
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <sc.icon className="h-4 w-4 text-primary" />
                  </div>

                  {/* Info — flex-1 with min-w-0 to truncate properly */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{inv.invoice_number}</span>
                      <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 shrink-0 ${sc.className}`}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {custName} · {formatDate(inv.issue_date)}
                    </p>
                  </div>

                  {/* Amount + menu — fixed, never wraps */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="text-sm font-bold tabular-nums">
                      {formatCurrency(Number(inv.total), currency)}
                    </span>
                    <ActionMenu
                      inv={inv}
                      currency={currency}
                      loading={actionLoading === inv.id}
                      onMarkPaid={() => markAsPaid(inv)}
                      onDelete={() => deleteInvoice(inv)}
                      onCopyLink={() => copyLink(inv)}
                      onWhatsApp={() => shareWhatsApp(inv)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
