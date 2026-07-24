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
import { Plus, Search, Pencil, Trash2, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BLANK_FORM = { name: "", description: "", price: "", cost: "", category: "", unit: "" };

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setPageLoading(true);
    const sb = createClient();
    const { data: biz, error: bizError } = await getDefaultBusiness(sb);
    if (bizError) {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    setBusiness(biz);
    const { data, error } = await sb.from("products").select("*").eq("business_id", biz.id).order("name");
    if (error) toast({ title: "Couldn't load products", description: error.message, variant: "destructive" });
    setProducts(data ?? []);
    setPageLoading(false);
  }

  function openAdd() { setEditing(null); setForm(BLANK_FORM); setOpen(true); }
  function openEdit(p: any) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), cost: String(p.cost ?? 0), category: p.category ?? "", unit: p.unit ?? "" });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setEditing(null); setForm(BLANK_FORM); }
  }

  async function handleSave() {
    if (!form.name.trim() || !business) return;
    const parsedPrice = parseFloat(form.price);
    const parsedCost = parseFloat(form.cost);
    if (form.price && (isNaN(parsedPrice) || parsedPrice < 0)) {
      toast({ title: "Invalid price", description: "Price must be a positive number.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const sb = createClient();
    const data = {
      name: form.name.trim(),
      description: form.description,
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      cost: isNaN(parsedCost) ? 0 : parsedCost,
      category: form.category,
      unit: form.unit,
    };
    if (editing) {
      const { error } = await sb.from("products").update(data).eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Product updated" });
    } else {
      const { error } = await sb.from("products").insert({ ...data, business_id: business.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Product added" });
    }
    setOpen(false); setLoading(false); loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    const sb = createClient();
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Product deleted" });
    loadData();
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  // Icon color rotation based on category
  const iconColors = ["bg-indigo-100 dark:bg-indigo-500/10", "bg-emerald-100 dark:bg-emerald-500/10", "bg-amber-100 dark:bg-amber-500/10", "bg-pink-100 dark:bg-pink-500/10", "bg-sky-100 dark:bg-sky-500/10"];
  function iconColor(idx: number) { return iconColors[idx % iconColors.length]; }

  if (pageLoading) return (
    <div>
      <Header title="Products & Services" description="Your product and service catalog" icon={Package} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Products & Services" description="Your product and service catalog"
        actions={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild><Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="Web Design Package" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Price ({business?.currency ?? "USD"})</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost ({business?.currency ?? "USD"})</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Cost to deliver this product/service</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input placeholder="Service, Product..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input placeholder="hour, item, month..." value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Brief description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.name.trim()} className="w-full">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Product" : "Add Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-3 sm:p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search ? "No products match your search." : "No products yet. Add your first product or service!"}</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, idx) => {
              const profit = Number(p.price) - Number(p.cost ?? 0);
              const margin = Number(p.price) > 0 ? (profit / Number(p.price) * 100) : 0;
              return (
                <Card key={p.id} className="group relative hover:shadow-md transition-shadow">
                  <CardContent className="p-5 text-center">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${iconColor(idx)}`}>
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    {/* Name + category */}
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[p.category, p.unit ? `per ${p.unit}` : null].filter(Boolean).join(" · ") || "No category"}
                    </p>
                    {/* Price */}
                    <p className="text-lg font-bold text-primary mt-3">{formatCurrency(p.price, business?.currency)}</p>
                    {/* Cost + profit */}
                    {Number(p.cost ?? 0) > 0 ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                        profit {formatCurrency(profit, business?.currency)} · {margin.toFixed(0)}%
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">profit {formatCurrency(p.price, business?.currency)}</p>
                    )}
                    {/* Hover actions */}
                    <div className="flex justify-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" className="h-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3 w-3" />
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
