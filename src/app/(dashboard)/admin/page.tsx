"use client";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

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

export default function AdminPage() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing")
        .maybeSingle();
      if (data) setPricing({ ...DEFAULT_PRICING, ...data.value });
    } catch {}
    setLoading(false);
  }

  async function savePricing() {
    setSaving(true);
    try {
      const sb = createClient();
      const { error } = await sb
        .from("platform_settings")
        .upsert({ key: "pricing", value: pricing });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Pricing updated" });
      }
    } catch {
      toast({ title: "Error", description: "Could not save", variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div>
        <Header title="Admin Panel" description="Platform management" icon={Shield} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Admin Panel" description="Platform management" icon={Shield} />
      <div className="p-3 sm:p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Pricing</CardTitle>
            <CardDescription>Set the rates businesses pay to use Brandfledger</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Monthly rate ({pricing.currency})</label>
                <input
                  type="number"
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={pricing.monthly_rate}
                  onChange={e => setPricing(p => ({ ...p, monthly_rate: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Annual rate ({pricing.currency})</label>
                <input
                  type="number"
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={pricing.annual_rate}
                  onChange={e => setPricing(p => ({ ...p, annual_rate: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Currency</label>
                <select
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={pricing.currency}
                  onChange={e => setPricing(p => ({ ...p, currency: e.target.value }))}
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
                  value={pricing.trial_days}
                  onChange={e => setPricing(p => ({ ...p, trial_days: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Features (one per line)</label>
              <textarea
                className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                value={pricing.features.join("\n")}
                onChange={e => setPricing(p => ({ ...p, features: e.target.value.split("\n").filter(Boolean) }))}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={savePricing} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
