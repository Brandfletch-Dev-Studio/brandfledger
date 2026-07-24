"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Users, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCachedFetch, clearCache } from "@/hooks/use-cached-fetch";

const BLANK_FORM = { name: "", email: "", phone: "", address: "", notes: "" };

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

export default function CustomersPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const bizId = typeof window !== "undefined" ? localStorage.getItem("activeBusinessId") : null;
  const { data: pageData, loading: pageLoading, refreshing, refetch } = useCachedFetch({
    key: `customers:${bizId ?? "default"}`,
    fetcher: async () => {
      const sb = createClient();
      const { data: biz, error: bizError } = await getDefaultBusiness(sb);
      if (bizError || !biz) throw new Error("No business found");
      setBusiness(biz);
      const [custRes, invRes, txRes] = await Promise.all([
        sb.from("customers").select("*").eq("business_id", biz.id).order("name"),
        sb.from("invoices").select("id, customer_id, total, status").eq("business_id", biz.id),
        sb.from("transactions").select("client_name, amount, cost_amount").eq("business_id", biz.id).eq("type", "income"),
      ]);
      return { customers: custRes.data ?? [], invoices: invRes.data ?? [], incomeTx: txRes.data ?? [] };
    },
  });

  const customers = pageData?.customers ?? [];
  const invoices = pageData?.invoices ?? [];
  const incomeTx = pageData?.incomeTx ?? [];

  function openAdd() { setEditing(null); setForm(BLANK_FORM); setOpen(true); }
  function openEdit(c: any) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) { setOpen(v); if (!v) { setEditing(null); setForm(BLANK_FORM); } }

  async function handleSave() {
    if (!form.name.trim() || !business) return;
    setLoading(true);
    const sb = createClient();
    if (editing) {
      const { error } = await sb.from("customers").update(form).eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Client updated" });
    } else {
      const { error } = await sb.from("customers").insert({ ...form, business_id: business.id, total_invoiced: 0 });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Client added" });
    }
    setOpen(false); setLoading(false);
    clearCache(`customers:${bizId ?? "default"}`);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this client?")) return;
    const sb = createClient();
    const { error } = await sb.from("customers").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Client deleted" });
    clearCache(`customers:${bizId ?? "default"}`);
    refetch();
  }

  const filtered = customers.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.toLowerCase().includes(search.toLowerCase())
  );

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
      <Header title="Clients" description="Manage your client database" icon={Users}
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild><Button onClick={openAdd} size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Client</Button></DialogTrigger>
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
              const customerTx = incomeTx.filter((t: any) => t.client_name?.toLowerCase() === c.name.toLowerCase());
              const txCount = customerTx.length;
              const totalRevenue = customerTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
              return (
                <Card key={c.id} className="hover:bg-muted/50 transition-colors group">
                  <CardContent className="flex items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${palette.bg}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {txCount > 0 ? `${txCount} transaction${txCount !== 1 ? "s" : ""} · ${formatCurrency(totalRevenue, business?.currency)}` : c.email || "No transactions yet"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
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
