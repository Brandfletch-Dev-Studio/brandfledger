"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, Building2, Check, Loader2, X, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { clearAllCaches } from "@/hooks/use-cached-fetch";

const currencies = ["MWK", "USD", "EUR", "GBP", "ZAR", "NGN", "KES", "GHS", "CAD", "AUD", "TZS", "UGX", "RWF"];

interface Business {
  id: string;
  name: string;
  currency: string;
  invoice_prefix?: string;
  subscription_status?: string;
}

export function BusinessSwitcher({ currentName }: { currentName?: string | null }) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(currentName);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ name: "", currency: "MWK", invoice_prefix: "INV" });

  useEffect(() => {
    setDisplayName(currentName);
  }, [currentName]);

  useEffect(() => {
    const stored = localStorage.getItem("activeBusinessId");
    setActiveId(stored);
    loadBusinesses();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadBusinesses() {
    try {
      const res = await fetch("/api/data/businesses");
      if (!res.ok) return;
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch {}
  }

  function switchBusiness(b: Business) {
    clearAllCaches();
    localStorage.setItem("activeBusinessId", b.id);
    setActiveId(b.id);
    setDisplayName(b.name);
    setOpen(false);
    router.refresh();
  }

  async function handleAddBusiness() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/data/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      toast({ title: "Business created!", description: data.business.name });
      setBusinesses(prev => [...prev, data.business]);
      clearAllCaches();
      localStorage.setItem("activeBusinessId", data.business.id);
      setActiveId(data.business.id);
      setDisplayName(data.business.name);
      setForm({ name: "", currency: "MWK", invoice_prefix: "INV" });
      setAddOpen(false);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  const activeBiz = businesses.find(b => b.id === activeId);
  const shownName = displayName || activeBiz?.name || "Select business";

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 min-w-0 px-1.5 py-1.5 rounded-lg hover:bg-muted"
        >
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <img src="/icons/icon-192.png" alt="" className="h-5 w-5 rounded-md" />
          </div>
          <span className="text-xs sm:text-sm font-semibold truncate max-w-[7rem] sm:max-w-xs">
            {shownName}
          </span>
          <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-72 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden">
            <div className="p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 tracking-wider">
                Your businesses
              </p>
              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {businesses.map(b => {
                  const isActive = b.id === activeId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => switchBusiness(b)}
                      className={`flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.currency} · {b.subscription_status || "trial"}</p>
                      </div>
                      {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t p-2">
              <button
                onClick={() => { setAddOpen(true); setOpen(false); }}
                className="flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="font-medium">Add new business</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Business Sheet */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border bg-card shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-200 sm:animate-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">New business</h2>
                <p className="text-sm text-muted-foreground">Each business has its own data & invoices</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="p-2 rounded-xl hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Business name *</label>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Hamaz Boreholes Ltd"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleAddBusiness()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Currency</label>
                  <select
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  >
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Invoice prefix</label>
                  <input
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="INV"
                    maxLength={6}
                    value={form.invoice_prefix}
                    onChange={e => setForm(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBusiness}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Creating..." : "Create business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
