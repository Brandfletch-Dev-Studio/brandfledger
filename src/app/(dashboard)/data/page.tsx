"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Database, Trash2, Download, FileText, Users, Package,
  AlertTriangle, Loader2, CheckCircle2, Share2, BarChart3,
  ArrowLeftRight, Tag, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface Counts {
  transactions: number;
  customers: number;
  products: number;
  categories: number;
  invoices: number;
}

const DATA_SECTIONS = [
  { key: "transactions", label: "Transactions", icon: ArrowLeftRight, color: "text-indigo-600", href: "/transactions" },
  { key: "customers", label: "Clients", icon: Users, color: "text-emerald-600", href: "/customers" },
  { key: "products", label: "Products", icon: Package, color: "text-amber-600", href: "/products" },
  { key: "categories", label: "Categories", icon: Tag, color: "text-purple-600", href: "/transactions" },
  { key: "invoices", label: "Invoices", icon: FileText, color: "text-rose-600", href: "/invoices" },
];

export default function DataManagementPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/manage");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCounts(data.counts);
    } catch (err: any) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleClear(scope: string) {
    const label = scope === "all" ? "ALL DATA" : DATA_SECTIONS.find(s => s.key === scope)?.label;
    if (!confirm(`Delete ALL ${label}? This cannot be undone.`)) return;

    setClearing(scope);
    try {
      const res = await fetch(`/api/data/manage?scope=${scope}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear");
      toast({
        title: `${scope === "all" ? "All data" : label} cleared`,
        description: "Data has been permanently deleted.",
      });
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClearing(null);
      setConfirmAll(false);
    }
  }

  async function handleExport(type: string) {
    setExporting(type);
    try {
      const res = await fetch(`/api/data/export?type=${type}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `export_${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: "CSV file downloaded." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }

  async function handleShare(type: string) {
    const label = type === "summary" ? "Summary Report" : (DATA_SECTIONS.find(s => s.key === type)?.label || "Export");
    try {
      const res = await fetch(`/api/data/export?type=${type}`);
      if (!res.ok) throw new Error("Failed to generate");
      const blob = await res.blob();
      const file = new File([blob], `${label.toLowerCase().replace(/\s/g, "_")}.csv`, { type: "text/csv" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: label, text: `Brandfledger ${label} export` });
      } else if (navigator.share) {
        await navigator.share({ title: label, text: `Export ${label} from Brandfledger` });
      } else {
        // Fallback: download + copy to clipboard
        handleExport(type);
        toast({ title: "Sharing not supported", description: "Downloaded file instead." });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ title: "Share failed", description: err.message, variant: "destructive" });
      }
    }
  }

  if (loading) return (
    <div>
      <Header title="Data Management" description="Clear, export & share your data" icon={Database} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  const totalRecords = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div>
      <Header title="Data Management" description="Clear, export & share your data" icon={Database} />
      <div className="p-3 sm:p-6 max-w-2xl space-y-6">

        {/* Overview */}
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Total Records</p>
                <p className="text-3xl font-bold mt-1">{totalRecords}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Database className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 mt-4">
              {DATA_SECTIONS.map(s => (
                <div key={s.key} className="text-center">
                  <div className={`text-lg font-bold ${s.color}`}>{counts?.[s.key as keyof Counts] ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Export Section */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" /> Export Data
          </h2>
          <div className="space-y-2">
            <ExportCard
              icon={BarChart3}
              color="text-indigo-600"
              title="Summary Report"
              desc="Business overview: revenue, costs, profit, counts"
              onExport={() => handleExport("summary")}
              onShare={() => handleShare("summary")}
              exporting={exporting === "summary"}
            />
            <ExportCard
              icon={ArrowLeftRight}
              color="text-emerald-600"
              title="Transactions"
              desc={`${counts?.transactions ?? 0} records — all income & expense entries`}
              onExport={() => handleExport("transactions")}
              onShare={() => handleShare("transactions")}
              exporting={exporting === "transactions"}
            />
            <ExportCard
              icon={Users}
              color="text-amber-600"
              title="Clients"
              desc={`${counts?.customers ?? 0} records — customer database`}
              onExport={() => handleExport("customers")}
              onShare={() => handleShare("customers")}
              exporting={exporting === "customers"}
            />
            <ExportCard
              icon={Package}
              color="text-purple-600"
              title="Products"
              desc={`${counts?.products ?? 0} records — product catalog with pricing`}
              onExport={() => handleExport("products")}
              onShare={() => handleShare("products")}
              exporting={exporting === "products"}
            />
          </div>
        </div>

        {/* Clear Individual Data */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" /> Clear Individual Data
          </h2>
          <div className="space-y-2">
            {DATA_SECTIONS.map(s => (
              <ClearCard
                key={s.key}
                icon={s.icon}
                color={s.color}
                title={s.label}
                count={counts?.[s.key as keyof Counts] ?? 0}
                onClear={() => handleClear(s.key)}
                onView={() => router.push(s.href)}
                clearing={clearing === s.key}
              />
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Danger Zone</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete ALL data for this business — transactions, clients, products, categories, and invoices.
              This action cannot be undone.
            </p>
            {!confirmAll ? (
              <Button variant="destructive" className="w-full" onClick={() => setConfirmAll(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear All Data
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400 text-center">
                  Are you absolutely sure? Type-confirm required.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmAll(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={clearing === "all"}
                    onClick={() => handleClear("all")}
                  >
                    {clearing === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Yes, Delete Everything
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExportCard({ icon: Icon, color, title, desc, onExport, onShare, exporting }: {
  icon: any; color: string; title: string; desc: string;
  onExport: () => void; onShare: () => void; exporting: boolean;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onShare} title="Share">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onExport} disabled={exporting} className="h-8 px-3">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ClearCard({ icon: Icon, color, title, count, onClear, onView, clearing }: {
  icon: any; color: string; title: string; count: number;
  onClear: () => void; onView: () => void; clearing: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className={`h-4.5 w-4.5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{count} record{count !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onView} title="View">
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={onClear}
            disabled={clearing || count === 0}
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
