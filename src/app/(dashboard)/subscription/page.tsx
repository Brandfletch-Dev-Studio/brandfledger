"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Loader2, Clock, PartyPopper, Phone, Smartphone, CheckCircle2, RefreshCw } from "lucide-react";
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
  features: ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"],
};

type Step = "plan" | "phone" | "waiting" | "success" | "failed";

export default function SubscriptionPage() {
  const { toast } = useToast();
  // Stable toast ref — prevents infinite re-render in polling useEffect
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("monthly");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<"airtel" | "tnm">("airtel");
  const [paying, setPaying] = useState(false);
  const [chargeId, setChargeId] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [trial, setTrial] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/data/pricing");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.pricing) setPricing({ ...DEFAULT_PRICING, ...data.pricing });
      if (data.subscription) setTrial(data.subscription);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-detect operator from phone number
  useEffect(() => {
    const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
    if (/^(88|89)/.test(digits)) setOperator("tnm");
    else if (digits.length >= 2) setOperator("airtel");
  }, [phone]);

  // Poll for payment confirmation — use chargeId and step as stable deps only
  useEffect(() => {
    if (step !== "waiting" || !chargeId) return;

    let stopped = false;
    let count = 0;

    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/paychangu/verify?charge_id=${encodeURIComponent(chargeId)}`);
        const data = await res.json();
        if (data.status === "success") {
          stopped = true;
          clearInterval(interval);
          setStep("success");
          toastRef.current({ title: "🎉 Payment confirmed!", description: "Your subscription is now active." });
        } else if (data.status === "failed") {
          stopped = true;
          clearInterval(interval);
          setStep("failed");
        }
      } catch {}
      count += 1;
      setPollCount(count);
    }, 5000);

    // Stop polling after 3 minutes
    const timeout = setTimeout(() => {
      stopped = true;
      clearInterval(interval);
    }, 180000);

    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [step, chargeId]); // NO toast in deps — use toastRef instead

  async function handlePay() {
    const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
    if (digits.length !== 9) {
      toast({
        title: "Invalid phone number",
        description: `Enter your 9-digit number without the country code (e.g. 991234567). You entered ${digits.length} digits.`,
        variant: "destructive"
      });
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/paychangu/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, phone, operator }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChargeId(data.chargeId);
        setPollCount(0);
        setStep("waiting");
        toast({ title: "Payment request sent!", description: data.message || "Check your phone for the payment prompt." });
      } else {
        toast({ title: "Payment failed", description: data.error ?? "Could not initiate payment.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach payment server.", variant: "destructive" });
    }
    setPaying(false);
  }

  const currency = pricing.currency || "MWK";
  const isSubscribed = trial?.status === "active";
  const trialActive = trial?.status === "trial" && (trial.daysLeft ?? 0) > 0;

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
      <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4">

        {/* Trial / active banner */}
        {isSubscribed && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Subscription active</p>
                <p className="text-xs text-muted-foreground">
                  {trial?.subscriptionEndsAt
                    ? `Renews ${new Date(trial.subscriptionEndsAt).toLocaleDateString()}`
                    : "All features unlocked"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {trialActive && !isSubscribed && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>{trial.daysLeft} day{trial.daysLeft !== 1 ? "s" : ""}</strong> left in your free trial
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 1: Choose plan ── */}
        {step === "plan" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {(["monthly", "annual"] as const).map(plan => {
                const price = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
                const saving = plan === "annual"
                  ? Math.round((1 - pricing.annual_rate / (pricing.monthly_rate * 12)) * 100)
                  : 0;
                return (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                      selectedPlan === plan
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    {saving > 0 && (
                      <span className="absolute -top-2 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Save {saving}%
                      </span>
                    )}
                    <p className="text-xs font-medium text-muted-foreground capitalize">{plan}</p>
                    <p className="text-lg font-extrabold mt-1">{formatCurrency(price, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">/{plan === "annual" ? "year" : "month"}</p>
                    {selectedPlan === plan && (
                      <CheckCircle2 className="absolute bottom-3 right-3 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            <Card>
              <CardContent className="p-4 space-y-2">
                {(pricing.features || DEFAULT_PRICING.features).map((f: string) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button className="w-full h-12 text-base font-semibold" onClick={() => setStep("phone")}>
              Continue with Mobile Money
            </Button>
          </>
        )}

        {/* ── STEP 2: Phone number ── */}
        {step === "phone" && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-base">Enter your mobile money number</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  You will receive a payment prompt on your phone
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "airtel", label: "Airtel Money", hint: "096–099" },
                  { id: "tnm",    label: "TNM Mpamba",   hint: "088–089" },
                ].map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperator(op.id as "airtel" | "tnm")}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      operator === op.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <Smartphone className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-semibold">{op.label}</p>
                    <p className="text-[10px] text-muted-foreground">{op.hint}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Mobile number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">+265</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="99 123 4567"
                    maxLength={13}
                    className="w-full pl-14 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enter the 9 digits after +265 — e.g. 991234567
                </p>
              </div>

              <div className="flex items-center justify-between text-sm bg-muted rounded-xl px-4 py-3">
                <span className="text-muted-foreground capitalize">{selectedPlan} plan</span>
                <span className="font-bold">
                  {formatCurrency(
                    selectedPlan === "annual" ? pricing.annual_rate : pricing.monthly_rate,
                    currency
                  )}
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("plan")}>
                  Back
                </Button>
                <Button className="flex-1 font-semibold" disabled={paying} onClick={handlePay}>
                  {paying
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                    : "Pay Now"
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Waiting ── */}
        {step === "waiting" && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                <Smartphone className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-base">Check your phone</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  A prompt has been sent to{" "}
                  <strong>+265 {phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "")}</strong>.
                  Approve it on your {operator === "tnm" ? "TNM Mpamba" : "Airtel Money"} app.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for confirmation… ({Math.min(pollCount * 5, 180)}s)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep("phone")}>
                  Change number
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setPollCount(0)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Success ── */}
        {step === "success" && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-6 text-center space-y-3">
              <PartyPopper className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-base text-emerald-700 dark:text-emerald-300">Payment confirmed!</h3>
              <p className="text-sm text-muted-foreground">Your subscription is now active. All features unlocked.</p>
              <Button className="w-full" onClick={() => (window.location.href = "/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 5: Failed ── */}
        {step === "failed" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center space-y-3">
              <div className="text-destructive text-3xl font-bold">✕</div>
              <h3 className="font-bold text-base text-destructive">Payment not completed</h3>
              <p className="text-sm text-muted-foreground">The payment was declined or timed out. Please try again.</p>
              <Button variant="outline" className="w-full" onClick={() => setStep("phone")}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
