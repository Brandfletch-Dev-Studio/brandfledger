"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Users, Loader2, RefreshCw, Phone, Mail, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const BLANK_FORM = { name: "", email: "", phone: "", address: "", notes: "" };

function getPalette(name: string) {
  const palettes = [
    "bg-indigo-100 text-indigo-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-sky-100 text-sky-700",
    "bg-rose-100 text-rose-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

export default function CustomersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [incomeTx, setIncomeTx] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setPageLoading(true);
    try {
      const res = await fetch("/api/data/customers");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      setCustomers(data.customers ?? []);
      setIncomeTx(data.incomeTx ?? []);
    } catch (err: any) {
      toast({ title: "Error loading clients", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAdd() { setEditing(null); setForm(BLANK_FORM); setOpen(true); }
  function openEdit(c: any) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) { setOpen(v); if (!v) { setEditing(null); setForm(BLANK_FORM); } }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await fetch("/api/data/customers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editing ? "Client updated" : "Client added" });
      setOpen(false);
      fetchData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this client?")) return;
    try {
      const res = await fetch(`/api/data/customers?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "Client deleted" });
      fetchData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filtered = customers
    .filter((c: any) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase())
    )
    .map((c: any) => {
      const txs = incomeTx.filter((t: any) => t.client_name?.toLowerCase() === c.name.toLowerCase());
      const rev = txs.reduce((s: number, t: any) => s + Number(t.amount), 0);
      return { ...c, _revenue: rev };
    })
    .sort((a: any, b: any) => b._revenue - a._revenue);

  const currency = business?.currency ?? "MWK";

  if (pageLoading) return (
    <div>
      <Header title="Clients" description="Manage your client database" icon={Users} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header
        title="Clients"
        description="Manage your client database"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Client</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Name *</Label><Input placeholder="Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input placeholder="+265 999 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Address</Label><Input placeholder="City, Country" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Notes</Label><Input placeholder="Any notes about this client" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                  <Button onClick={handleSave} disabled={loading || !form.name.trim()} className="w-full">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Client" : "Add Client"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        {/* Summary strip */}
        {customers.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Clients", value: customers.length.toString() },
              { label: "Total Revenue", value: formatCurrency(incomeTx.reduce((s: number, t: any) => s + Number(t.amount), 0), currency) },
              { label: "Total Profit", value: formatCurrency(incomeTx.reduce((s: number, t: any) => s + Number(t.profit || 0), 0), currency) },
            ].map(({ label, value }) => (
              <Card key={label} className="shadow-sm overflow-hidden">
                <CardContent className="p-2 sm:p-3 text-center">
                  <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide font-medium leading-tight">{label}</div>
                  <div className="text-sm sm:text-base font-bold mt-0.5 text-indigo-600 break-all leading-tight">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {customers.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm font-medium">No clients yet. Add your first client!</p>
          </CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm font-medium">No clients match your search.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c: any) => {
              const palette = getPalette(c.name);
              const customerTx = incomeTx.filter((t: any) =>
                t.client_name?.toLowerCase() === c.name.toLowerCase()
              );
              const txCount = customerTx.length;
              const totalRevenue = customerTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
              const totalProfit = customerTx.reduce((s: number, t: any) => s + Number(t.profit || (Number(t.amount) - Number(t.cost_amount || 0))), 0);
              const lastDate = customerTx[0]?.date;

              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Avatar + name + meta */}
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => router.push(`/customers/${c.id}`)}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${palette}`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{c.name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {c.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />{c.phone}
                              </span>
                            )}
                            {c.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />{c.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats row */}
                    {txCount > 0 ? (
                      <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-1 text-center">
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs text-muted-foreground">Orders</div>
                          <div className="text-xs sm:text-sm font-semibold">{txCount}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs text-muted-foreground">Revenue</div>
                          <div className="text-xs sm:text-sm font-semibold text-emerald-600 break-all leading-tight">{formatCurrency(totalRevenue, currency)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs text-muted-foreground">Profit</div>
                          <div className="text-xs sm:text-sm font-semibold text-indigo-600 break-all leading-tight flex items-center justify-center gap-0.5 flex-wrap">
                            <TrendingUp className="h-3 w-3 shrink-0" />
                            <span>{formatCurrency(totalProfit, currency)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground italic">No transactions yet</span>
                      </div>
                    )}

                    {lastDate && (
                      <div className="mt-1 text-xs text-muted-foreground text-right">
                        Last order: {formatDate(lastDate)}
                      </div>
                    )}
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

