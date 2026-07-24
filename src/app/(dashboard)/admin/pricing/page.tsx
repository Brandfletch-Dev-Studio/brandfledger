"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PRICING = {
  monthly_rate: 15000,
  annual_rate: 150000,
  currency: "MWK",
  trial_days: 14,
  features: ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"],
};

export default function AdminPricingPage() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<any>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=pricing");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.pricing) setPricing({ ...DEFAULT_PRICING, ...data.pricing });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadPricing(); }, [loadPricing]);

  async function savePricing() {
    setSaving(true);
    try {
      const res = await fetch("/api/data/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_pricing", pricing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: "Pricing updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Subscription Pricing</h2>
        <p className="text-sm text-muted-foreground">Set the rates businesses pay to use Brandfledger.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing Configuration</CardTitle>
          <CardDescription>These rates apply to all businesses on the platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monthly rate ({pricing.currency})</Label>
              <Input type="number" className="mt-1.5" value={pricing.monthly_rate} onChange={e => setPricing((p: any) => ({ ...p, monthly_rate: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Annual rate ({pricing.currency})</Label>
              <Input type="number" className="mt-1.5" value={pricing.annual_rate} onChange={e => setPricing((p: any) => ({ ...p, annual_rate: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Currency</Label>
              <select className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={pricing.currency} onChange={e => setPricing((p: any) => ({ ...p, currency: e.target.value }))}>
                {["MWK", "USD", "ZAR", "NGN", "KES", "GHS", "EUR", "GBP"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Trial days</Label>
              <Input type="number" className="mt-1.5" value={pricing.trial_days} onChange={e => setPricing((p: any) => ({ ...p, trial_days: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <textarea className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px]" value={pricing.features.join("\n")} onChange={e => setPricing((p: any) => ({ ...p, features: e.target.value.split("\n").filter(Boolean) }))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={savePricing} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save pricing
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-sm">
        <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly</span><span className="font-bold">{formatCurrency(pricing.monthly_rate, pricing.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Annual</span><span className="font-bold">{formatCurrency(pricing.annual_rate, pricing.currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Trial</span><span className="font-bold">{pricing.trial_days} days</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
