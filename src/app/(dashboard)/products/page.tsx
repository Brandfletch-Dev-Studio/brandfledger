"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Package, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BLANK_FORM = { name: "", description: "", price: "", cost: "", unit: "" };

export default function ProductsPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setPageLoading(true);
    try {
      const res = await fetch("/api/data/products");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      setProducts(data.products ?? []);
      setCategories(data.categories ?? []);
    } catch (err: any) {
      toast({ title: "Couldn't load products", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() { setEditing(null); setForm(BLANK_FORM); setOpen(true); }
  function openEdit(p: any) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "",
      price: String(p.price), cost: String(p.cost ?? 0),
      unit: p.unit ?? "",
    });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setEditing(null); setForm(BLANK_FORM); }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const parsedPrice = parseFloat(form.price);
    const parsedCost = parseFloat(form.cost);
    if (form.price && (isNaN(parsedPrice) || parsedPrice < 0)) {
      toast({ title: "Invalid price", description: "Price must be a positive number.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description,
        price: form.price || "0",
        cost: form.cost || "0",
        unit: form.unit,
        is_active: true,
      };
      const method = editing ? "PUT" : "POST";
      const fullBody = editing ? { ...body, id: editing.id } : body;
      const res = await fetch("/api/data/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: editing ? "Product updated" : "Product added" });
      setOpen(false);
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`/api/data/products?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast({ title: "Product deleted" });
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const currency = business?.currency ?? "MWK";

  if (pageLoading) return (
    <div>
      <Header title="Products" description="Manage your product catalog" icon={Package} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Products" description="Manage your product catalog" icon={Package}
        actions={
          <div className="flex items-center gap-2">
            {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild><Button onClick={openAdd} size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Product</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Product name" /></div>
                  <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Price *</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" /></div>
                    <div className="space-y-2"><Label>Cost</Label><Input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" /></div>
                  </div>
                  <div className="space-y-2"><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="ea, hr, kg..." /></div>
                  <Button onClick={handleSave} disabled={loading || !form.name.trim()} className="w-full">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editing ? "Update Product" : "Add Product"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="p-3 sm:p-6 space-y-4">
        {products.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Products</div>
              <div className="text-lg font-bold mt-0.5">{products.length}</div>
            </CardContent></Card>
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg Price</div>
              <div className="text-lg font-bold mt-0.5 text-indigo-600">
                {formatCurrency(products.reduce((s, p) => s + Number(p.price), 0) / products.length, currency)}
              </div>
            </CardContent></Card>
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg Margin</div>
              <div className="text-lg font-bold mt-0.5 text-emerald-600">
                {products.length > 0
                  ? `${(products.reduce((s, p) => s + (Number(p.profit_margin) || 0), 0) / products.length).toFixed(1)}%`
                  : "0%"}
              </div>
            </CardContent></Card>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{search ? "No products match your search." : "No products yet. Add your first product!"}</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => {
              const profit = Number(p.price) - Number(p.cost || 0);
              const margin = Number(p.profit_margin) || (Number(p.price) > 0 ? (profit / Number(p.price) * 100) : 0);
              return (
                <Card key={p.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Price</div>
                        <div className="text-sm font-bold text-indigo-600">{formatCurrency(Number(p.price), currency)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cost</div>
                        <div className="text-sm font-semibold text-rose-600">{formatCurrency(Number(p.cost || 0), currency)}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600">{formatCurrency(profit, currency)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{margin.toFixed(1)}% margin</span>
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
