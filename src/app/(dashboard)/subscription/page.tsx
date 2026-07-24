"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Loader2, Settings, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PricingConfig {
  monthly_rate: number;
  annual_rate: number;
  currency: string;
  trial_days: number;
  features: string[];
}

const DEFAULT_PRICING: PricingConfig = {
  monthly_rate: 15000,
  annual_rate: 150000,
  currency: "MWK",
  trial_days: 14,
  features: [
    "Unlimited invoices",
    "Unlimited businesses",
    "Profit tracking",
    "Team members",
    "Reports & exports",
    "Priority support",
  ],
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<PricingConfig>(DEFAULT_PRICING);

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing")
        .maybeSingle();

      if (error || !data) {
        setPricing(DEFAULT_PRICING);
        setEditForm(DEFAULT_PRICING);
      } else {
        const config = { ...DEFAULT_PRICING, ...data.value };
        setPricing(config);
        setEditForm(config);
      }
    } catch {
      setPricing(DEFAULT_PRICING);
      setEditForm(DEFAULT_PRICING);
    }
    setLoading(false);
  }

  async function savePricing() {
    setSaving(true);
    try {
      const sb = createClient();
      const { error } = await sb
        .from("platform_settings")
        .upsert({ key: "pricing", value: editForm });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setPricing(editForm);
        setAdminMode(false);
        toast({ title: "Pricing updated" });
      }
    } catch {
      toast({ title: "Error", description: "Could not save pricing", variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div>
        <Header title="Pricing" description="Simple, transparent pricing" icon={Crown} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const monthlyUSD = (pricing.monthly_rate / 4300).toFixed(2);
  const annualUSD = (pricing.annual_rate / 4300).toFixed(2);

  return (
    <div>
      <Header title="Pricing" description="Simple, transparent pricing" icon={Crown} />

      <div className="p-3 sm:p-6 space-y-6">
        {/* Admin toggle */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdminMode(!adminMode)}
          >
            <Settings className="h-4 w-4 mr-1.5" />
            {adminMode ? "Exit admin" : "Admin settings"}
          </Button>
        </div>

        {adminMode ? (
          /* Admin pricing editor */
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-base">Adjust pricing</CardTitle>
              <CardDescription>Set the rates businesses pay to use Brandfledger</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Monthly rate ({editForm.currency})</label>
                  <input
                    type="number"
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editForm.monthly_rate}
                    onChange={e => setEditForm(p => ({ ...p, monthly_rate: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Annual rate ({editForm.currency})</label>
                  <input
                    type="number"
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editForm.annual_rate}
                    onChange={e => setEditForm(p => ({ ...p, annual_rate: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <select
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editForm.currency}
                    onChange={e => setEditForm(p => ({ ...p, currency: e.target.value }))}
                  >
                    {["MWK", "USD", "ZAR", "NGN", "KES", "GHS", "EUR", "GBP"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Trial days</label>
                  <input
                    type="number"
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={editForm.trial_days}
                    onChange={e => setEditForm(p => ({ ...p, trial_days: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Features (one per line)</label>
                <textarea
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                  value={editForm.features.join("\n")}
                  onChange={e => setEditForm(p => ({ ...p, features: e.target.value.split("\n").filter(Boolean) }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setEditForm(pricing); setAdminMode(false); }}>
                  Cancel
                </Button>
                <Button onClick={savePricing} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save pricing
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Public pricing display */
          <>
            <div className="max-w-md mx-auto">
              <Card className="border-primary shadow-lg">
                <div className="bg-primary text-primary-foreground text-center py-3 rounded-t-lg">
                  <Badge variant="outline" className="border-primary-foreground/30 text-primary-foreground bg-transparent">
                    {pricing.trial_days}-day free trial
                  </Badge>
                </div>
                <CardHeader className="text-center pt-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">Brandfledger Pro</CardTitle>
                  </div>
                  <div className="text-4xl font-extrabold tracking-tight">
                    {formatCurrency(pricing.monthly_rate, pricing.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  </div>
                  <CardDescription>
                    or {formatCurrency(pricing.annual_rate, pricing.currency)}/year (save 2 months)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {pricing.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" size="lg">
                    Start {pricing.trial_days}-day free trial
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    No credit card required • Cancel anytime
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
