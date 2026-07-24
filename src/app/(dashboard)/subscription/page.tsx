"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2 } from "lucide-react";
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

      if (data) {
        setPricing({ ...DEFAULT_PRICING, ...data.value });
      }
    } catch {}
    setLoading(false);
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

  return (
    <div>
      <Header title="Pricing" description="Simple, transparent pricing" icon={Crown} />
      <div className="p-3 sm:p-6">
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
      </div>
    </div>
  );
}
