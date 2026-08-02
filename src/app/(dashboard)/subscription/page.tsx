"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Check, Crown, Loader2, PartyPopper, Phone, Smartphone,
  CheckCircle2, RefreshCw, Calendar, CreditCard, TrendingUp,
  Building2, FileText, Users, ArrowRight, Zap, AlertCircle, X
} from "lucide-react";
import { formatCurrency, formatCurrencyFull } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PricingConfig {
  monthly_rate: number;
  annual_rate: number;
  currency: string;
  trial_days: number;
  features: string[];
}

type Step = "overview" | "phone" | "waiting" | "success" | "failed";
type Plan = "monthly" | "annual";

export default function BillingPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("overview");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<"airtel" | "tnm">("airtel");
  const [paying, setPaying] = useState(false);
  const [chargeId, setChargeId] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [canceling, setCanceling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/data/billing");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      if (d.currentSubscription?.plan) {
        setSelectedPlan(d.currentSubscription.plan);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-detect operator from phone
  useEffect(() => {
    const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
    if (/^(88|89)/.test(digits)) setOperator("tnm");
    else if (digits.length >= 2) setOperator("airtel");
  }, [phone]);

  // Polling for payment confirmation
  useEffect(() => {
    if (step !== "waiting" || !chargeId) return;
    let stopped = false;
    let count = 0;
    const interval = setInterval(async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/paychangu/verify?charge_id=${encodeURIComponent(chargeId)}`);
        const d = await res.json();
        if (d.status === "success") {
          stopped = true; clearInterval(interval);
          setStep("success");
          loadData();
          toastRef.current({ title: "Payment confirmed!", description: "Your subscription is now active." });
        } else if (d.status === "failed") {
          stopped = true; clearInterval(interval);
          setStep("failed");
        }
      } catch {}
      count += 1;
      setPollCount(count);
    }, 4000);
    const timeout = setTimeout(() => { stopped = true; clearInterval(interval); }, 300000);
    return () => { stopped = true; clearInterval(interval); clearTimeout(timeout); };
  }, [step, chargeId]);

  async function handlePay() {
    const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
    if (digits.length !== 9) {
      toast({ title: "Invalid phone number", description: `Enter your 9-digit number (e.g. 991234567). You entered ${digits.length} digits.`, variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/paychangu/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, phone, operator }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setChargeId(d.chargeId);
        setPollCount(0);
        setStep("waiting");
        toast({ title: "Payment request sent!", description: d.message || "Check your phone for the payment prompt." });
      } else {
        toast({ title: "Payment failed", description: d.error ?? "Could not initiate payment.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach payment server.", variant: "destructive" });
    }
    setPaying(false);
  }

  async function handleCancelSubscription() {
    if (!confirm("Cancel your subscription? You'll lose access at the end of your current billing period.")) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/data/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Subscription cancelled", description: "Your subscription will remain active until the end of the billing period." });
        loadData();
      } else {
        toast({ title: "Error", description: d.error || "Could not cancel subscription", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    }
    setCanceling(false);
  }

  const pricing: PricingConfig = data?.pricing || {
    monthly_rate: 15000, annual_rate: 150000, currency: "MWK", trial_days: 14,
    features: ["Unlimited invoices", "Unlimited businesses", "Profit tracking", "Team members", "Reports & exports", "Priority support"],
  };
  const currency = pricing.currency || "MWK";
  const access = data?.access || "trial";
  const daysLeft = data?.daysLeft || 0;
  const isActive = access === "active";
  const isTrial = access === "trial";
  const isExpired = access === "expired";
  const trialProgress = isTrial && data?.profile?.trial_ends_at
    ? Math.max(0, Math.min(100, ((pricing.trial_days - daysLeft) / pricing.trial_days) * 100))
    : 0;
  const annualSaving = Math.round((1 - pricing.annual_rate / (pricing.monthly_rate * 12)) * 100);

  if (loading) {
    return (
      <div>
        <Header title="Billing & Subscription" description="Manage your plan and payments" icon={CreditCard} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <Header title="Billing & Subscription" description="Manage your plan and payments" icon={CreditCard} />

      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

        {/* === STATUS OVERVIEW === */}
        <Card className={isActive ? "border-emerald-500/30" : isExpired ? "border-destructive/30" : "border-amber-500/30"}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-base">Current Plan</h3>
                  {isActive && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">Active</Badge>}
                  {isTrial && <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20">Trial</Badge>}
                  {isExpired && <Badge variant="destructive">Expired</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isActive && data?.profile?.subscription_ends_at
                    ? `Active until ${new Date(data.profile.subscription_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                    : isTrial
                    ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining in your trial`
                    : "Your trial has expired"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold">
                  {formatCurrency(
                    data?.currentSubscription?.plan === "annual" ? pricing.annual_rate : pricing.monthly_rate,
                    currency
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{data?.currentSubscription?.plan === "annual" ? "year" : "month"}
                </p>
              </div>
            </div>

            {/* Trial progress bar */}
            {isTrial && (
              <div className="space-y-1.5">
                <Progress value={trialProgress} className="h-2" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Trial started</span>
                  <span>{daysLeft} days left</span>
                </div>
              </div>
            )}

            {/* Renewal info for active */}
            {isActive && data?.profile?.subscription_ends_at && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Next renewal: {new Date(data.profile.subscription_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* === PLAN SELECTION (show when not active or when upgrading) === */}
        {(isTrial || isExpired || step !== "overview") && step !== "success" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">{isActive ? "Change Plan" : "Choose Your Plan"}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["monthly", "annual"] as Plan[]).map(plan => {
                const price = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
                const isCurrent = data?.currentSubscription?.plan === plan && isActive;
                return (
                  <button
                    key={plan}
                    onClick={() => !isCurrent && setSelectedPlan(plan)}
                    disabled={isCurrent}
                    className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                      isCurrent
                        ? "border-emerald-500/40 bg-emerald-500/5 cursor-default"
                        : selectedPlan === plan
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    {plan === "annual" && annualSaving > 0 && (
                      <span className="absolute -top-2 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Save {annualSaving}%
                      </span>
                    )}
                    <p className="text-xs font-medium text-muted-foreground capitalize">{plan}</p>
                    <p className="text-lg font-extrabold mt-1">{formatCurrency(price, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">/{plan === "annual" ? "year" : "month"}</p>
                    {isCurrent ? (
                      <Badge className="mt-2 text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/20">Current</Badge>
                    ) : selectedPlan === plan && (
                      <CheckCircle2 className="absolute bottom-3 right-3 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Features list */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">What's included:</p>
                {(pricing.features || []).map((f: string) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Payment CTA */}
            {step === "overview" && (
              <Button className="w-full h-12 text-base font-semibold" onClick={() => setStep("phone")}>
                {isActive ? "Change Plan" : isExpired ? "Reactivate Now" : "Subscribe Now"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* === MANAGE ACTIVE SUBSCRIPTION === */}
        {isActive && step === "overview" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Manage Subscription</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cancel or change your plan anytime</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={canceling}
                  onClick={handleCancelSubscription}
                  className="text-destructive hover:text-destructive"
                >
                  {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === MOBILE MONEY PAYMENT STEP === */}
        {step === "phone" && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-base">Enter your mobile money number</h3>
                <p className="text-xs text-muted-foreground mt-1">You'll receive a payment prompt on your phone</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "airtel", label: "Airtel Money", hint: "096–099" },
                  { id: "tnm", label: "TNM Mpamba", hint: "088–089" },
                ].map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperator(op.id as "airtel" | "tnm")}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      operator === op.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <Smartphone className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-semibold">{op.label}</p>
                    <p className="text-[10px] text-muted-foreground">{op.hint}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Mobile number</label>
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
                <p className="text-[11px] text-muted-foreground mt-1">Enter the 9 digits after +265 — e.g. 991234567</p>
              </div>

              <div className="flex items-center justify-between text-sm bg-muted rounded-xl px-4 py-3">
                <span className="text-muted-foreground capitalize">{selectedPlan} plan</span>
                <span className="font-bold">{formatCurrencyFull(selectedPlan === "annual" ? pricing.annual_rate : pricing.monthly_rate, currency)}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("overview")}>Back</Button>
                <Button className="flex-1 font-semibold" disabled={paying} onClick={handlePay}>
                  {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : "Pay Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === WAITING FOR PAYMENT === */}
        {step === "waiting" && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                <Smartphone className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-base">Check your phone</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  A prompt has been sent to <strong>+265 {phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "")}</strong>.
                  Approve it on your {operator === "tnm" ? "TNM Mpamba" : "Airtel Money"} app.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for confirmation… ({Math.min(pollCount * 4, 300)}s)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep("phone")}>Change number</Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setPollCount(0)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === PAYMENT SUCCESS === */}
        {step === "success" && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-6 text-center space-y-3">
              <PartyPopper className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-base text-emerald-700 dark:text-emerald-300">Payment confirmed!</h3>
              <p className="text-sm text-muted-foreground">Your subscription is now active. All features unlocked.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("overview"); loadData(); }}>View Billing</Button>
                <Button className="flex-1" onClick={() => window.location.href = "/dashboard"}>Go to Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === PAYMENT FAILED === */}
        {step === "failed" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center space-y-3">
              <X className="h-10 w-10 text-destructive mx-auto" />
              <h3 className="font-bold text-base text-destructive">Payment not completed</h3>
              <p className="text-sm text-muted-foreground">The payment was declined or timed out. Please try again.</p>
              <Button variant="outline" className="w-full" onClick={() => setStep("phone")}>Try Again</Button>
            </CardContent>
          </Card>
        )}

        {/* === USAGE STATS === */}
        {data?.usage && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Your Usage</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.usage.businesses}</p>
                    <p className="text-[11px] text-muted-foreground">Businesses</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.usage.invoices}</p>
                    <p className="text-[11px] text-muted-foreground">Invoices</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.usage.transactions}</p>
                    <p className="text-[11px] text-muted-foreground">Transactions</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{data.usage.teamMembers}</p>
                    <p className="text-[11px] text-muted-foreground">Team Members</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* === PAYMENT HISTORY === */}
        {data?.paymentHistory && data.paymentHistory.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Payment History</h3>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {data.paymentHistory.map((pay: any, i: number) => (
                    <div key={pay.id || i} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold capitalize">{pay.plan}</p>
                          {pay.status === "active" && <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 border-emerald-500/20">Active</Badge>}
                          {pay.status === "pending" && <Badge className="text-[9px] bg-amber-500/15 text-amber-700 border-amber-500/20">Pending</Badge>}
                          {pay.status === "cancelled" && <Badge className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">Cancelled</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {pay.created_at ? new Date(pay.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          {pay.end_date && pay.status === "active" ? ` → ${new Date(pay.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold">{formatCurrencyFull(pay.amount || 0, pay.currency || currency)}</p>
                        <p className="text-[10px] text-muted-foreground">Mobile Money</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* === EXPired TRIAL WARNING === */}
        {isExpired && step === "overview" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Trial expired</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your free trial has ended. Subscribe now to regain access to your financial data and continue using Brandfledger.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
