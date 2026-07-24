"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Phone, Mail, MapPin, FileText, Pencil, Loader2, TrendingUp, ShoppingBag, Calendar, DollarSign, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";

function getPalette(name: string) {
  const palettes = [
    { bg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
    { bg: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
    { bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
    { bg: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" },
    { bg: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" },
    { bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

export default function ClientDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/customers");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);

      const found = (data.customers || []).find((c: any) => c.id === clientId);
      if (!found) {
        toast({ title: "Client not found", variant: "destructive" });
        router.push("/customers");
        return;
      }
      setCustomer(found);
      setForm({
        name: found.name || "",
        email: found.email || "",
        phone: found.phone || "",
        address: found.address || "",
        notes: found.notes || "",
      });

      // Match transactions by client_name
      const clientTx = (data.incomeTx || []).filter(
        (t: any) => t.client_name?.toLowerCase() === found.name.toLowerCase()
      );
      setTransactions(clientTx);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, router, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave() {
    if (!form.name.trim() || !customer) return;
    setSaving(true);
    try {
      const res = await fetch("/api/data/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast({ title: "Client updated" });
      setEditOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Client not found.</p>
        <Button variant="outline" onClick={() => router.push("/customers")}>Back to Clients</Button>
      </div>
    );
  }

  const currency = business?.currency ?? "MWK";
  const palette = getPalette(customer.name);
  const totalRevenue = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const totalCost = transactions.reduce((s, t) => s + Number(t.cost_amount || 0), 0);
  const totalProfit = transactions.reduce((s, t) => s + Number(t.profit || Number(t.amount) - Number(t.cost_amount || 0)), 0);
  const avgOrderValue = transactions.length > 0 ? totalRevenue / transactions.length : 0;

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <button onClick={() => router.push("/customers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </button>

      {/* Header card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-bold text-2xl shrink-0 ${palette.bg}`}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" /> {customer.phone}
                  </a>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {customer.address}
                  </span>
                )}
              </div>
              {customer.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">"{customer.notes}"</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Orders</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{transactions.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Value</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-primary">{formatCurrency(totalRevenue, currency)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Profit</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{formatCurrency(totalProfit, currency)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Receipt className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Avg Order</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(avgOrderValue, currency)}</p>
        </div>
      </div>

      {/* Order history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Order History</h2>
        </div>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No orders from this client yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Date</th>
                    <th className="text-left font-semibold text-muted-foreground p-3">Description</th>
                    <th className="text-left font-semibold text-muted-foreground p-3 whitespace-nowrap">Method</th>
                    <th className="text-right font-semibold text-muted-foreground p-3 whitespace-nowrap">Amount</th>
                    <th className="text-right font-semibold text-muted-foreground p-3 whitespace-nowrap">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                      <td className="p-3">{t.description || "—"}</td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{t.payment_method || "—"}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(Number(t.amount), currency)}</td>
                      <td className="p-3 text-right font-medium text-emerald-600">
                        {formatCurrency(Number(t.profit || Number(t.amount) - Number(t.cost_amount || 0)), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
