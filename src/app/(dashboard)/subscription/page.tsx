"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Check, Loader2, PartyPopper, Phone, Smartphone,
  CheckCircle2, RefreshCw, Calendar, CreditCard, TrendingUp,
  Building2, FileText, Users, ArrowRight, Zap, AlertCircle, X,
  HelpCircle, Mail, Clock, ShieldCheck, Sparkles, ChevronDown,
  ChevronUp, Wallet
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
type Tab = "overview" | "plans" | "history" | "support";

export default function BillingPage() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [step, setStep] = useState<Step>("overview");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("monthly");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<"airtel" | "tnm">("airtel");
  const [paying, setPaying] = useState(false);
  const [chargeId, setChargeId] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

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

  useEffect(() => {
    const digits = phone.replace(/\D/g, "").replace(/^265/, "").replace(/^0/, "");
    if (/^(88|89)/.test(digits)) setOperator("tnm");
    else if (digits.length >= 2) setOperator("airtel");
  }, [phone]);

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

  function handleUpgradePlan(plan: Plan) {
    setSelectedPlan(plan);
    setIsUpgrading(true);
    setStep("phone");
    setActiveTab("overview");
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
  const currentPlan: Plan = data?.currentSubscription?.plan === "annual" ? "annual" : "monthly";

  const faqs = [
    {
      q: "How does the free trial work?",
      a: `You get ${pricing.trial_days} days of full access to all Brandfledger features. No credit card required. At the end of your trial, you'll need to subscribe to keep using the platform.`,
    },
    {
      q: "Can I change plans anytime?",
      a: "Yes. You can switch between monthly and annual at any time. If you upgrade to annual, you'll be charged immediately and get the remaining value of your current plan added to your new subscription period.",
    },
    {
      q: "What payment methods do you accept?",
      a: "We currently accept Airtel Money and TNM Mpamba mobile money payments. Enter your phone number and approve the prompt on your phone to pay.",
    },
    {
      q: "Can I cancel my subscription?",
      a: "Yes, you can cancel anytime. Your subscription remains active until the end of your current billing period, then your account reverts to a limited free tier.",
    },
    {
      q: "What happens to my data if I cancel?",
      a: "Your data is preserved even after cancellation. If you reactivate your subscription later, all your businesses, transactions, invoices, and reports will be right where you left them.",
    },
    {
      q: "Do you offer refunds?",
      a: "If you're not satisfied within the first 7 days of a paid subscription, contact us at chibondo.arthur@gmail.com for a full refund.",
    },
  ];

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

        {/* === TAB NAVIGATION === */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {([
            { id: "overview" as Tab, label: "Overview", icon: CreditCard },
            { id: "plans" as Tab, label: "Plans", icon: Zap },
            { id: "history" as Tab, label: "History", icon: Calendar },
            { id: "support" as Tab, label: "Support", icon: HelpCircle },
          ]).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* === OVERVIEW TAB === */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Status card */}
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
                        isActive ? (currentPlan === "annual" ? pricing.annual_rate : pricing.monthly_rate) : pricing.monthly_rate,
                        currency
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      /{currentPlan === "annual" ? "year" : "month"}
                    </p>
                  </div>
                </div>

                {isTrial && (
                  <div className="space-y-1.5">
                    <Progress value={trialProgress} className="h-2" />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Trial started</span>
                      <span>{daysLeft} days left</span>
                    </div>
                  </div>
                )}

                {isActive && data?.profile?.subscription_ends_at && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Next renewal: {new Date(data.profile.subscription_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment flow steps */}
            {step !== "overview" && (
              <>
                {step === "phone" && (
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                          <Phone className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-bold text-base">
                          {isUpgrading ? "Pay to switch plans" : "Enter your mobile money number"}
                        </h3>
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
                        <Button variant="outline" className="flex-1" onClick={() => { setStep("overview"); setIsUpgrading(false); }}>Back</Button>
                        <Button className="flex-1 font-semibold" disabled={paying} onClick={handlePay}>
                          {paying ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : "Pay Now"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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

                {step === "success" && (
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-6 text-center space-y-3">
                      <PartyPopper className="h-10 w-10 text-emerald-600 mx-auto" />
                      <h3 className="font-bold text-base text-emerald-700 dark:text-emerald-300">Payment confirmed!</h3>
                      <p className="text-sm text-muted-foreground">
                        {isUpgrading ? "Your plan has been updated." : "Your subscription is now active. All features unlocked."}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { setStep("overview"); setIsUpgrading(false); loadData(); }}>View Billing</Button>
                        <Button className="flex-1" onClick={() => window.location.href = "/dashboard"}>Go to Dashboard</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
              </>
            )}

            {/* Subscribe CTA for trial/expired */}
            {(isTrial || isExpired) && step === "overview" && (
              <>
                {isExpired && (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-destructive">Trial expired</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your free trial has ended. Subscribe now to regain access to your financial data.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Subscribe to Brandfledger</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {(["monthly", "annual"] as Plan[]).map(plan => {
                        const price = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
                        return (
                          <button
                            key={plan}
                            onClick={() => setSelectedPlan(plan)}
                            className={`relative rounded-2xl border-2 p-3 text-left transition-all ${
                              selectedPlan === plan ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            {plan === "annual" && annualSaving > 0 && (
                              <span className="absolute -top-2 right-2 text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                                Save {annualSaving}%
                              </span>
                            )}
                            <p className="text-xs font-medium text-muted-foreground capitalize">{plan}</p>
                            <p className="text-lg font-extrabold mt-0.5">{formatCurrency(price, currency)}</p>
                            <p className="text-[10px] text-muted-foreground">/{plan === "annual" ? "year" : "month"}</p>
                            {selectedPlan === plan && <CheckCircle2 className="absolute bottom-2 right-2 h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                    <Button className="w-full h-11 font-semibold" onClick={() => setStep("phone")}>
                      {isExpired ? "Reactivate Now" : "Subscribe Now"} <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Manage active subscription */}
            {isActive && step === "overview" && (
              <Card>
                <CardContent className="p-4 space-y-3">
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
                  <Separator />
                  {/* Upgrade to annual if currently monthly */}
                  {currentPlan === "monthly" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Switch to Annual</p>
                          <p className="text-[11px] text-muted-foreground">Save {annualSaving}% per year</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleUpgradePlan("annual")}>
                        Upgrade
                      </Button>
                    </div>
                  )}
                  {/* Downgrade to monthly if currently annual */}
                  {currentPlan === "annual" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Switch to Monthly</p>
                          <p className="text-[11px] text-muted-foreground">More flexible, billed monthly</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleUpgradePlan("monthly")}>
                        Change
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Usage stats */}
            {data?.usage && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Your Usage</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Building2, label: "Businesses", value: data.usage.businesses },
                    { icon: FileText, label: "Invoices", value: data.usage.invoices },
                    { icon: ArrowRight, label: "Transactions", value: data.usage.transactions },
                    { icon: Users, label: "Team Members", value: data.usage.teamMembers },
                  ].map(stat => {
                    const Icon = stat.icon;
                    return (
                      <Card key={stat.label}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xl font-bold">{stat.value}</p>
                            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === PLANS TAB === */}
        {activeTab === "plans" && (
          <div className="space-y-5">
            <div className="text-center py-2">
              <h3 className="font-bold text-lg">Choose Your Plan</h3>
              <p className="text-sm text-muted-foreground mt-1">All plans include the same features. Choose your billing cycle.</p>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["monthly", "annual"] as Plan[]).map(plan => {
                const price = plan === "annual" ? pricing.annual_rate : pricing.monthly_rate;
                const period = plan === "annual" ? "year" : "month";
                const isCurrent = isActive && currentPlan === plan;
                return (
                  <Card
                    key={plan}
                    className={`relative ${plan === "annual" ? "border-primary/40" : ""} ${isCurrent ? "ring-2 ring-emerald-500/30" : ""}`}
                  >
                    {plan === "annual" && annualSaving > 0 && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
                        Save {annualSaving}%
                      </div>
                    )}
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold capitalize">{plan}</p>
                        {isCurrent && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20">Current</Badge>}
                      </div>
                      <p className="text-2xl font-extrabold">{formatCurrency(price, currency)}</p>
                      <p className="text-xs text-muted-foreground mb-4">/{period}</p>

                      <div className="space-y-2 mb-5">
                        {(pricing.features || []).map((f: string) => (
                          <div key={f} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={plan === "annual" ? "default" : "outline"}
                          onClick={() => { setSelectedPlan(plan); setStep("phone"); setActiveTab("overview"); }}
                        >
                          {isActive ? "Switch Plan" : isExpired ? "Reactivate" : "Subscribe"} <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col items-center gap-1 text-center">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-[11px] text-muted-foreground">Secure payment</p>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Clock className="h-5 w-5 text-primary" />
                <p className="text-[11px] text-muted-foreground">Cancel anytime</p>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Check className="h-5 w-5 text-primary" />
                <p className="text-[11px] text-muted-foreground">7-day refund</p>
              </div>
            </div>
          </div>
        )}

        {/* === HISTORY TAB === */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Payment History</h3>
            </div>

            {data?.paymentHistory && data.paymentHistory.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {data.paymentHistory.map((pay: any, i: number) => (
                      <div key={pay.id || i} className="flex items-center justify-between px-4 py-3.5">
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
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No payments yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Your payment history will appear here once you subscribe.</p>
                  {(isTrial || isExpired) && (
                    <Button className="mt-4" size="sm" onClick={() => { setActiveTab("plans"); }}>
                      View Plans <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Billing info */}
            {data?.businesses && data.businesses.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">BILLED TO</p>
                  {data.businesses.map((biz: any) => (
                    <div key={biz.id} className="flex items-center gap-2 text-sm py-1">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{biz.name}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* === SUPPORT TAB === */}
        {activeTab === "support" && (
          <div className="space-y-5">
            {/* Contact */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Billing Support</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Questions about your subscription, payment issues, or refunds? We're here to help.
                </p>
                <a href="mailto:chibondo.arthur@gmail.com?subject=Brandfledger%20Billing%20Support">
                  <Button variant="outline" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    chibondo.arthur@gmail.com
                  </Button>
                </a>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Typical response time: within 24 hours</span>
                </div>
              </CardContent>
            </Card>

            {/* FAQ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Frequently Asked Questions</h3>
              </div>

              {faqs.map((faq, i) => (
                <Card key={i}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    >
                      <span className="text-sm font-medium pr-2">{faq.q}</span>
                      {openFaq === i ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-3.5">
                        <p className="text-sm text-muted-foreground">{faq.a}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
