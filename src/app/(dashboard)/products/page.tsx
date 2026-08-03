"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Search, Pencil, Trash2, Package, Loader2, RefreshCw, TrendingUp,
  AlertTriangle, Boxes, PackageCheck, ArrowDownToLine, ClipboardCheck, X
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BLANK_FORM = { name: "", description: "", price: "", cost: "", unit: "", stock_quantity: "", reorder_level: "" };

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

  // Stock adjustment dialog
  const [stockOpen, setStockOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<any>(null);
  const [stockAction, setStockAction] = useState<"restock" | "adjust" | "loss">("restock");
  const [stockQty, setStockQty] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockLoading, setStockLoading] = useState(false);

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
      stock_quantity: String(p.stock_quantity ?? 0),
      reorder_level: String(p.reorder_level ?? 0),
    });
    setOpen(true);
  }
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { setEditing(null); setForm(BLANK_FORM); }
  }

  function openStockAdjust(product: any, action: "restock" | "adjust" | "loss") {
    setStockProduct(product);
    setStockAction(action);
    setStockQty(action === "adjust" ? String(product.stock_quantity ?? 0) : "");
    setStockCost("");
    setStockNote("");
    setStockOpen(true);
  }

  async function handleStockSave() {
    if (!stockProduct) return;
    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty < 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    setStockLoading(true);
    try {
      const res = await fetch("/api/data/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: stockProduct.id,
          action: stockAction,
          quantity: stockAction === "adjust" ? qty : qty,
          unit_cost: stockAction === "restock" ? parseFloat(stockCost) || 0 : 0,
          note: stockNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust stock");
      toast({
        title: stockAction === "restock" ? "Stock restocked" : stockAction === "loss" ? "Stock loss recorded" : "Stock adjusted",
        description: `${stockProduct.name}: ${data.product?.stock_quantity ?? qty} ${stockProduct.stock_unit || "units"} on hand`,
      });
      setStockOpen(false);
      loadData(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setStockLoading(false);
    }
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
        stock_quantity: form.stock_quantity || "0",
        reorder_level: form.reorder_level || "0",
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
  const lowStockCount = products.filter(p => Number(p.stock_quantity || 0) <= Number(p.reorder_level || 0) && Number(p.reorder_level || 0) > 0).length;
  const outOfStockCount = products.filter(p => Number(p.stock_quantity || 0) <= 0).length;
  const totalStockValue = products.reduce((s, p) => s + Number(p.cost || 0) * Number(p.stock_quantity || 0), 0);

  if (pageLoading) return (
    <div>
      <Header title="Products & Inventory" description="Manage your catalog and stock" icon={Package} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div>
      <Header title="Products & Inventory" description="Manage your catalog and stock" icon={Package}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Stock Quantity</Label><Input type="number" min="0" step="0.01" value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} placeholder="0" /></div>
                    <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" min="0" step="0.01" value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} placeholder="0 (alert threshold)" /></div>
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
          <div className="grid grid-cols-4 gap-2">
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Products</div>
              <div className="text-lg font-bold mt-0.5">{products.length}</div>
            </CardContent></Card>
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Stock Value</div>
              <div className="text-sm font-bold mt-1 text-primary">{formatCurrency(totalStockValue, currency)}</div>
            </CardContent></Card>
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Low Stock</div>
              <div className={`text-lg font-bold mt-0.5 ${lowStockCount > 0 ? "text-amber-600" : ""}`}>{lowStockCount}</div>
            </CardContent></Card>
            <Card className="shadow-sm"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Out of Stock</div>
              <div className={`text-lg font-bold mt-0.5 ${outOfStockCount > 0 ? "text-destructive" : ""}`}>{outOfStockCount}</div>
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
              const stock = Number(p.stock_quantity || 0);
              const reorder = Number(p.reorder_level || 0);
              const isLowStock = stock <= reorder && reorder > 0;
              const isOutOfStock = stock <= 0;
              const stockUnit = p.stock_unit || "units";

              return (
                <Card key={p.id} className="shadow-sm hover:shadow-md transition-sm">
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
                        <div className="text-sm font-bold text-primary">{formatCurrency(Number(p.price), currency)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cost</div>
                        <div className="text-sm font-semibold text-destructive">{formatCurrency(Number(p.cost || 0), currency)}</div>
                      </div>
                    </div>

                    {/* Stock section */}
                    <div className="mt-2 pt-2 border-t flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isOutOfStock ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : isLowStock ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <PackageCheck className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        <span className={`text-xs font-medium ${isOutOfStock ? "text-destructive" : isLowStock ? "text-amber-600" : "text-emerald-600"}`}>
                          {isOutOfStock ? "Out of stock" : `${stock} ${stockUnit}`}
                        </span>
                        {isLowStock && !isOutOfStock && (
                          <span className="text-[10px] text-amber-500">(reorder at {reorder})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{margin.toFixed(1)}% margin</span>
                    </div>

                    {/* Stock actions */}
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openStockAdjust(p, "restock")}>
                        <ArrowDownToLine className="h-3 w-3 mr-1" />Restock
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openStockAdjust(p, "adjust")}>
                        <ClipboardCheck className="h-3 w-3 mr-1" />Count
                      </Button>
                      {stock > 0 && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => openStockAdjust(p, "loss")}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stockAction === "restock" ? "Restock Product" : stockAction === "loss" ? "Record Stock Loss" : "Stock Count Adjustment"}
            </DialogTitle>
          </DialogHeader>
          {stockProduct && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold text-sm">{stockProduct.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current stock: {Number(stockProduct.stock_quantity || 0)} {stockProduct.stock_unit || "units"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  {stockAction === "restock" ? "Quantity to add" : stockAction === "loss" ? "New stock level (after loss)" : "Counted quantity"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  placeholder="0"
                />
              </div>

              {stockAction === "restock" && (
                <div className="space-y-2">
                  <Label>Unit cost (optional — updates product cost)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockCost}
                    onChange={e => setStockCost(e.target.value)}
                    placeholder={String(stockProduct.cost || 0)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Input
                  value={stockNote}
                  onChange={e => setStockNote(e.target.value)}
                  placeholder={stockAction === "restock" ? "Supplier name, invoice ref..." : stockAction === "loss" ? "Reason for loss..." : "Stock take note..."}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStockOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  disabled={stockLoading || !stockQty}
                  onClick={handleStockSave}
                >
                  {stockLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
