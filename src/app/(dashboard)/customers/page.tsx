"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Business } from "@/types";

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
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
}

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const supabase = createClient();
    const { data: biz, error: bizError } = await getDefaultBusiness(supabase);
    if (bizError) {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);

    const [custRes, invRes, txRes] = await Promise.all([
      supabase.from("customers").select("*").eq("business_id", biz.id).order("name"),
      supabase.from("invoices").select("id, customer_id, total, status").eq("business_id", biz.id),
      supabase.from("transactions").select("client_name, cost_qty").eq("business_id", biz.id)
    ]);

    if (custRes.error) {
      toast({ title: "Couldn't load clients", description: custRes.error.message, variant: "destructive" });
    }
    setCustomers(custRes.data ?? []);
    setInvoices(invRes.data ?? []);
    setTransactions(txRes.data ?? []);
    setPageLoading(false);
  }

  function openAdd() { setEditing(null); setForm(BLANK_FORM); setOpen(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setEditing(null); setForm(BLANK_FORM); }
  }

  async function handleSave() {
    if (!form.name.trim() || !business) return;
    setLoading(true);
    const supabase = createClient();
    if (editing) {
      const { error } = await supabase.from("customers").update(form).eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Client updated" });
    } else {
      const { error } = await supabase.from("customers").insert({ ...form, business_id: business.id, total_invoiced: 0 });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Client added" });
    }
    setOpen(false); setLoading(false); loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this client? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Client deleted" });
    loadData();
  }

  const filtered = customers.filter(c =>
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
      <Header title="Clients" description="Manage your client database" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search clients..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+265 999 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input placeholder="City, Country" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Any notes about this client" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.name.trim()} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Client" : "Add Client"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {customers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm font-medium">No clients yet. Add your first client!</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm font-medium">No clients match your search.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(c => {
              const palette = getPalette(c.name);
              const customerInvoices = invoices.filter(i => i.customer_id === c.id);
              const customerTransactions = transactions.filter(t => t.client_name?.toLowerCase() === c.name.toLowerCase());
              const txCount = customerInvoices.length || customerTransactions.length;
              const totalAds = customerTransactions.reduce((sum, t) => sum + Number(t.cost_qty || 0), 0);
              
              const subtitle = totalAds > 0 
                ? `${txCount} transaction${txCount !== 1 ? "s" : ""} · ${totalAds} ad${totalAds !== 1 ? "s" : ""}`
                : `${txCount} transaction${txCount !== 1 ? "s" : ""}`;

              return (
                <Card key={c.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${palette.bg}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        {formatCurrency(c.total_invoiced ?? 0, business?.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">total paid</p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive hover:text-destructive/80" />
                      </Button>
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