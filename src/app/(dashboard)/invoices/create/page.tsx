"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowLeft, Plus, Trash2, Loader2, Save, Send, Phone, Mail, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface LineItem {
  id: string;
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  cost: number;
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), name: "", quantity: 1, unit_price: 0, cost: 0 };
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
  const [newClientName, setNewClientName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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

  function handleClientChange(value: string) {
    const c = customers.find(c => c.id === value);
    if (c) {
      setCustomerId(c.id);
      setNewClientName("");
      setContactEmail(c.email || "");
      setContactPhone(c.phone || "");
    } else {
      setCustomerId("");
      setNewClientName(value);
      setContactEmail("");
      setContactPhone("");
    }
  }

  const currency = business?.currency ?? "MWK";

  const clientOptions = customers.map(c => ({ value: c.id, label: c.name, subtitle: c.email || c.phone || "" }));
  const productOptions = products.map(p => ({
    value: p.id,
    label: p.name,
    subtitle: formatCurrency(Number(p.price), currency),
  }));

  function addLineItem() { setItems(prev => [...prev, newLineItem()]); }
  function removeLineItem(id: string) { setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev); }
  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }
  function onProductSelect(itemId: string, productId: string) {
    const p = products.find(p => p.id === productId);
    if (p) {
      setItems(prev => prev.map(i => i.id === itemId ? {
        ...i, product_id: productId, name: p.name,
        unit_price: Number(p.price), cost: Number(p.cost || 0),
      } : i));
    }
  }

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const totalCost = useMemo(() => items.reduce((s, i) => s + i.quantity * i.cost, 0), [items]);
  const taxAmount = useMemo(() => subtotal * (parseFloat(taxRate || "0") / 100), [subtotal, taxRate]);
  const total = subtotal + taxAmount;

  async function saveInvoice(status: "draft" | "sent") {
    if (!customerId && !newClientName.trim()) {
      toast({ title: "Select or type a client name", variant: "destructive" });
      return;
    }
    if (items.every(i => !i.name.trim())) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }

    setSaving(status === "sent" ? "send" : "draft");
    try {
      const customer = customers.find(c => c.id === customerId);
      const customerName = customer?.name || newClientName.trim();
      const emailToUse = contactEmail || customer?.email || null;
      const phoneToUse = contactPhone || customer?.phone || null;

      const validItems = items.filter(i => i.name.trim()).map((i, idx) => ({
        product_id: i.product_id || null,
        name: i.name, description: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price, price: i.unit_price,
        cost: i.cost,
        total: i.quantity * i.unit_price,
        sort_order: idx,
      }));

      const res = await fetch("/api/data/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId || null,
          customer_name: customerName,
          issue_date: issueDate, due_date: dueDate,
          status, notes,
          tax_rate: parseFloat(taxRate) || 0,
          items: validItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      const invoiceId = data.invoice.id;

      if (status === "sent" && emailToUse) {
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
            toast({ title: "Invoice sent!", description: `Email delivered to ${emailToUse}` });
          }
        } catch {
          toast({ title: "Invoice created", description: "Could not send email.", variant: "destructive" });
        }
      } else if (status === "sent" && !emailToUse) {
        toast({ title: "Invoice created", description: "No email on file — share the link manually." });
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
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-2xl mx-auto pb-40">
      <button onClick={() => router.push("/invoices")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </button>
      <h1 className="text-xl font-bold">Create Invoice</h1>

      {/* CLIENT */}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</h2>
        <div>
          <Label className="text-xs mb-1.5 block">Select client *</Label>
          <SearchableSelect
            options={clientOptions}
            value={customerId || newClientName}
            onChange={handleClientChange}
            placeholder="Search or type a new client…"
            searchPlaceholder="Type to search or add new…"
            allowCustom
          />
          {customers.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Type a name to add a new client, or add details in the Clients section.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
              <Mail className="h-3 w-3" /> Email
            </Label>
            <Input type="email" placeholder="client@email.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5 block">
              <Phone className="h-3 w-3" /> Phone / WhatsApp
            </Label>
            <Input type="tel" placeholder="+265..." value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      </section>

      {/* DATES */}
      <section className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 block">Issue Date</Label>
            <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      </section>

      {/* LINE ITEMS */}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</h2>
          <button type="button" onClick={addLineItem} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Item {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeLineItem(item.id)} className="text-rose-400 hover:text-rose-600 p-0.5">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {products.length > 0 && (
              <SearchableSelect
                options={productOptions}
                value={item.product_id ?? ""}
                onChange={v => onProductSelect(item.id, v)}
                placeholder="Auto-fill from catalog…"
                searchPlaceholder="Search products…"
              />
            )}

            <Input
              placeholder="Item name / description"
              value={item.name}
              onChange={e => updateItem(item.id, "name", e.target.value)}
              className="h-9 text-sm"
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
                <Input type="number" min="0.01" step="any" value={item.quantity}
                  onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Unit price</Label>
                <Input type="number" min="0" step="any" value={item.unit_price}
                  onChange={e => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Total</Label>
                <div className="h-9 rounded-lg border bg-muted/50 flex items-center px-3 text-sm font-semibold text-indigo-600">
                  {formatCurrency(item.quantity * item.unit_price, currency)}
                </div>
              </div>
            </div>

            {/* Cost field — not shown to client, for profit tracking */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Cost per unit <span className="text-muted-foreground/60">(internal, not on invoice)</span>
                </Label>
                <Input type="number" min="0" step="any" value={item.cost}
                  onChange={e => updateItem(item.id, "cost", parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm" placeholder="0.00" />
              </div>
              <div className="w-32 pt-5">
                <div className="h-9 rounded-lg border bg-muted/30 flex items-center px-3 text-xs text-muted-foreground">
                  Profit: <span className="font-semibold text-emerald-600 ml-1">
                    {formatCurrency((item.unit_price - item.cost) * item.quantity, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* TAX + NOTES */}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1.5 block">Tax rate (%)</Label>
            <Input type="number" min="0" max="100" step="0.1" value={taxRate}
              onChange={e => setTaxRate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Notes</Label>
            <Textarea placeholder="Payment terms, thank you note…" value={notes}
              onChange={e => setNotes(e.target.value)} rows={2} className="text-sm resize-none" />
          </div>
        </div>
      </section>

      {/* TOTALS */}
      <section className="rounded-2xl border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
        </div>
        {parseFloat(taxRate) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span className="font-medium">{formatCurrency(taxAmount, currency)}</span>
          </div>
        )}
        {totalCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> Total Cost (internal)
            </span>
            <span className="font-medium text-rose-500">{formatCurrency(totalCost, currency)}</span>
          </div>
        )}
        {totalCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <EyeOff className="h-3 w-3" /> Projected Profit
            </span>
            <span className="font-medium text-emerald-600">{formatCurrency(subtotal - totalCost, currency)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t pt-2">
          <span>Total</span>
          <span className="text-indigo-600">{formatCurrency(total, currency)}</span>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <div className="fixed bottom-0 left-0 right-0 px-3 pt-3 pb-[calc(0.75rem+56px+env(safe-area-inset-bottom))] bg-background border-t flex gap-2 z-50">
        <button type="button" onClick={() => saveInvoice("draft")} disabled={saving !== null}
          className="flex-1 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Draft
        </button>
        <button type="button" onClick={() => saveInvoice("sent")} disabled={saving !== null}
          className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50">
          {saving === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Create & Send
        </button>
      </div>
    </div>
  );
}
