"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Loader2, Save, Send } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface LineItem {
  id: string;
  product_id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  cost: number;
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), name: "", description: "", quantity: 1, unit_price: 0, cost: 0 };
}

export default function CreateInvoicePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [business, setBusiness] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLineItem()]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/invoices");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBusiness(data.business);
      setCustomers(data.customers ?? []);
      setProducts(data.products ?? []);
    } catch (err: any) {
      toast({ title: "Error loading data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const currency = business?.currency ?? "MWK";

  function addLineItem() { setItems(prev => [...prev, newLineItem()]); }
  function removeLineItem(id: string) { setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev); }
  function updateLineItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function onProductSelect(itemId: string, productId: string) {
    const product = products.find(p => p.id === productId);
    if (product) {
      setItems(prev => prev.map(i => i.id === itemId ? {
        ...i,
        product_id: productId,
        name: product.name,
        description: product.description ?? "",
        unit_price: Number(product.price),
        cost: Number(product.cost || 0),
      } : i));
    }
  }

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const taxAmount = useMemo(() => subtotal * (parseFloat(taxRate || "0") / 100), [subtotal, taxRate]);
  const total = subtotal + taxAmount;

  async function saveInvoice(status: "draft" | "sent") {
    if (!customerId || !business) {
      toast({ title: "Select a client", description: "Please choose a client for this invoice.", variant: "destructive" });
      return;
    }
    if (items.every(i => !i.name.trim())) {
      toast({ title: "Add items", description: "Add at least one line item.", variant: "destructive" });
      return;
    }

    setSaving(status === "sent" ? "send" : "draft");
    try {
      const customer = customers.find(c => c.id === customerId);
      const validItems = items.filter(i => i.name.trim()).map((i, idx) => ({
        product_id: i.product_id || null,
        name: i.name,
        description: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        price: i.unit_price,
        cost: i.cost,
        total: i.quantity * i.unit_price,
        sort_order: idx,
      }));

      const res = await fetch("/api/data/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customer?.name || null,
          issue_date: issueDate,
          due_date: dueDate,
          status,
          notes,
          tax_rate: parseFloat(taxRate) || 0,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      const invoiceId = data.invoice.id;

      // If sending, email the client
      if (status === "sent" && customer?.email) {
        try {
          const sendRes = await fetch("/api/invoices/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId }),
          });
          const sendData = await sendRes.json();
          if (!sendRes.ok) {
            toast({ title: "Invoice created", description: `Email failed: ${sendData.error}`, variant: "destructive" });
          } else {
            toast({ title: "Invoice sent!", description: `Email delivered to ${customer.email}` });
          }
        } catch {
          toast({ title: "Invoice created", description: "Could not send email — check client email address.", variant: "destructive" });
        }
      } else if (status === "sent" && !customer?.email) {
        toast({ title: "Invoice created", description: "Client has no email on file — couldn't send automatically." });
      } else {
        toast({ title: "Invoice saved as draft" });
      }

      router.push(`/invoices/${invoiceId}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-3xl">
      <button onClick={() => router.push("/invoices")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>

      <h1 className="text-xl font-bold">Create Invoice</h1>

      {/* Client & dates */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customers.length === 0 && (
                <p className="text-xs text-muted-foreground">Add clients first in the Clients page.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue date</Label>
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Line Items</Label>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add item
            </Button>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeLineItem(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {products.length > 0 && (
                <div>
                  <Select value={item.product_id ?? ""} onValueChange={v => onProductSelect(item.id, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Auto-fill from product catalog" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, currency)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Input placeholder="Item name" value={item.name} onChange={e => updateLineItem(item.id, "name", e.target.value)} className="h-9" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="1" step="1" placeholder="Qty" value={item.quantity} onChange={e => updateLineItem(item.id, "quantity", Number(e.target.value))} className="h-9" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" placeholder="Price" value={item.unit_price} onChange={e => updateLineItem(item.id, "unit_price", Number(e.target.value))} className="h-9" />
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <div className="h-9 flex items-center justify-end rounded-md border bg-muted/30 px-3 text-sm font-medium">
                    {formatCurrency(item.quantity * item.unit_price, currency)}
                  </div>
                </div>
              </div>
              <Input placeholder="Description (optional)" value={item.description} onChange={e => updateLineItem(item.id, "description", e.target.value)} className="h-9 text-xs" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tax & Notes */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tax rate (%)</Label>
              <Input type="number" min="0" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Payment terms, notes..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[38px] text-xs" rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        {parseFloat(taxRate) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span>{formatCurrency(taxAmount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Button variant="outline" className="flex-1" disabled={saving !== null} onClick={() => saveInvoice("draft")}>
          {saving === "draft" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save as Draft
        </Button>
        <Button className="flex-1" disabled={saving !== null} onClick={() => saveInvoice("sent")}>
          {saving === "send" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Create & Send
        </Button>
      </div>
    </div>
  );
}
