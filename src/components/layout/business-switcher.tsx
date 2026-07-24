"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAllBusinesses, getActiveBusinessId, setActiveBusinessId } from "@/lib/default-business";
import { ChevronDown, Plus, Building2, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const currencies = ["USD", "MWK", "ZAR", "NGN", "KES", "GHS", "EUR", "GBP", "CAD", "AUD"];

interface Business {
  id: string;
  name: string;
  currency: string;
  invoice_prefix?: string;
}

interface BusinessSwitcherProps {
  currentName?: string | null;
}

export function BusinessSwitcher({ currentName }: BusinessSwitcherProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ name: "", currency: "MWK", invoice_prefix: "INV" });

  useEffect(() => {
    loadBusinesses();
    setActiveId(getActiveBusinessId());
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
    const sb = createClient();
    const { data } = await getAllBusinesses(sb);
    setBusinesses(data ?? []);
  }

  function switchBusiness(id: string) {
    setActiveBusinessId(id);
    setActiveId(id);
    setOpen(false);
    router.refresh();
  }

  async function handleAddBusiness() {
    if (!form.name) return;
    setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.from("businesses").insert({
      name: form.name,
      currency: form.currency,
      invoice_prefix: form.invoice_prefix,
    }).select("id, name, currency, invoice_prefix").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Business created", description: form.name });
    setBusinesses(prev => [...prev, data]);
    setActiveBusinessId(data.id);
    setActiveId(data.id);
    setForm({ name: "", currency: "MWK", invoice_prefix: "INV" });
    setAddOpen(false);
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 min-w-0 px-1.5 py-1.5 rounded-lg hover:bg-muted"
        >
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-xs sm:text-sm font-semibold truncate max-w-[7rem] sm:max-w-xs">
            {currentName || "Select business"}
          </span>
          <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border bg-card shadow-lg z-50 p-2 max-h-[60vh] overflow-y-auto">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5">Your businesses</p>
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => switchBusiness(b.id)}
                className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-muted transition-colors"
              >
                <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${activeId === b.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {b.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate flex-1 font-medium">{b.name}</span>
                {activeId === b.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2.5 text-left text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="font-medium">Add business</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Business Dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border bg-card shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add new business</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Business name *</label>
                <input
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Hamaz Boreholes Ltd"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <select
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  >
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Invoice prefix</label>
                  <input
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="INV"
                    value={form.invoice_prefix}
                    onChange={e => setForm(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBusiness}
                disabled={loading || !form.name}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
