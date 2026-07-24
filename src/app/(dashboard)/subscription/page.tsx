"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, Clock, AlertCircle, Lock, PartyPopper, XCircle } from "lucide-react";
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
  const [paying, setPaying] = useState<"monthly" | "annual" | null>(null);
  const [trial, setTrial] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      setPaymentStatus(status);
      if (status === "success") {
        toast({ title: "Payment successful!", description: "Your subscription is now active." });
      } else if (status === "failed") {
        toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
      }
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const sb = createClient();
      const [pricingRes, bizRes] = await Promise.all([
        sb.from("platform_settings").select("value").eq("key", "pricing").maybeSingle(),
        getDefaultBusiness(sb),
      ]);

      if (pricingRes.data) setPricing({ ...DEFAULT_PRICING, ...pricingRes.data.value });
      if (bizRes.data) {
        const biz = bizRes.data as any;
        const status = biz.subscription_status || "trial";
        const trialEndsAt = biz.trial_ends_at;
        let daysLeft = 0;
        if (status === "trial" && trialEndsAt) {
          daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }
        setTrial({ status, daysLeft, trialEndsAt, subscriptionEndsAt: biz.subscription_ends_at });
      }
    } catch {}
    setLoading(false);
  }

  async function handlePay(plan: "monthly" | "annual") {
    setPaying(plan);
    try {
      const res = await fetch("/api/paychangu/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Payment error", description: data.error ?? "Could not start payment", variant: "destructive" });
      }
    } catch {
      toast({ title: "Payment error", description: "Network error", variant: "destructive" });
    }
    setPaying(null);
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

  const isTrialActive = trial?.status === "trial" && (trial.daysLeft ?? 0) > 0;
  const isSubscribed = trial?.status === "active";

  return (
    <div>
      <Header title="Pricing" description="Simple, transparent pricing" icon={Crown} />
      <div className="p-3 sm:p-6 space-y-5">
        {/* Payment status alert */}
        {paymentStatus === "success" && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <PartyPopper className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-sm text-emerald-700 dark:text-emerald-300">Payment successful!</p>
                <p className="text-xs text-muted-foreground">Your subscription is now active.</p>
              </div>
            </CardContent>
          </Card>
        )}
        {paymentStatus === "failed" && (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-medium text-sm text-rose-700 dark:text-rose-300">Payment failed</p>
                <p className="text-xs text-muted-foreground">Please try again or use a different payment method.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trial status */}
        {isTrialActive && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {trial.daysLeft <= 3
                    ? `${trial.daysLeft} day${trial.daysLeft !== 1 ? "s" : ""} left in your free trial`
                    : `Free trial active`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trial.daysLeft <= 3
                    ? "Your trial ends soon — subscribe to keep full access."
                    : `Trial ends on ${new Date(trial.trialEndsAt).toLocaleDateString()}`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already subscribed */}
        {isSubscribed && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm text-emerald-700 dark:text-emerald-300">Subscription active</p>
                <p className="text-xs text-muted-foreground">
                  {trial.subscriptionEndsAt
                    ? `Valid until ${new Date(trial.subscriptionEndsAt).toLocaleDateString()}`
                    : "Your subscription is active"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expired */}
        {trial?.status === "expired" && (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm text-rose-700 dark:text-rose-300">Free trial expired</p>
                <p className="text-xs text-muted-foreground">Subscribe now to unlock all features.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing card */}
        <div className="max-w-md mx-auto">
          <Card className={`shadow-lg ${!isSubscribed ? "border-primary" : ""}`}>
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

              {!isSubscribed ? (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => handlePay("monthly")}
                    disabled={paying !== null}
                  >
                    {paying === "monthly" ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecting to Paychangu...</>
                    ) : (
                      <>Pay {formatCurrency(pricing.monthly_rate, pricing.currency)}/month</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handlePay("annual")}
                    disabled={paying !== null}
                  >
                    {paying === "annual" ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecting...</>
                    ) : (
                      <>Pay {formatCurrency(pricing.annual_rate, pricing.currency)}/year (save 17%)</>
                    )}
                  </Button>
                </>
              ) : (
                <Button className="w-full" size="lg" disabled>
                  <Check className="h-4 w-4 mr-2" /> Active
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Secure payment via Paychangu · Cancel anytime
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
