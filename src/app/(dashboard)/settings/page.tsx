"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, MessageCircle, CheckCircle2, CreditCard, Plus, Trash2, Landmark, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "MWK", "ZAR", "NGN", "KES", "GHS", "INR", "PKR", "TZS", "UGX", "RWF"];

const businessTypes = [
  { value: "media", label: "Media & Advertising" },
  { value: "retail", label: "Retail / Shop" },
  { value: "wholesale", label: "Wholesale / Distribution" },
  { value: "services", label: "Services" },
  { value: "consulting", label: "Consulting" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "freelance", label: "Freelance" },
  { value: "agriculture", label: "Agriculture" },
  { value: "restaurant", label: "Restaurant / Food" },
  { value: "other", label: "Other" },
];

const paymentMethodTypes = [
  { value: "bank", label: "Bank Account", icon: Landmark },
  { value: "mobile_money", label: "Mobile Money", icon: Wallet },
  { value: "other", label: "Other", icon: CreditCard },
];

interface PaymentMethod {
  type: string;
  label: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  instructions: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [bizForm, setBizForm] = useState({
    name: "", email: "", phone: "", address: "", website: "",
    currency: "USD", invoice_prefix: "INV", business_type: "other", tax_id: "",
  });

  // Paychangu config
  const [paychanguSecret, setPaychanguSecret] = useState("");
  const [paychanguPublic, setPaychanguPublic] = useState("");
  const [paychanguConfigured, setPaychanguConfigured] = useState(false);

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // WhatsApp link state
  const [waNumber, setWaNumber] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [customInstructionsSaved, setCustomInstructionsSaved] = useState(false);
  const [waLinked, setWaLinked] = useState(false);
  const [platformNumber, setPlatformNumber] = useState("");
  const [waSaving, setWaSaving] = useState(false);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const [bizRes, waRes] = await Promise.all([
        fetch("/api/data/customers"),
        fetch("/api/data/whatsapp-link"),
      ]);

      if (bizRes.ok) {
        const data = await bizRes.json();
        const biz = data.business;
        if (biz) {
          setBusiness(biz);
          setBizForm({
            name: biz.name, email: biz.email ?? "", phone: biz.phone ?? "",
            address: biz.address ?? "", website: biz.website ?? "",
            currency: biz.currency, invoice_prefix: biz.invoice_prefix,
            business_type: biz.business_type ?? "other", tax_id: biz.tax_id ?? "",
          });
          setPaychanguSecret(biz.paychangu_secret_key ?? "");
          setPaychanguPublic(biz.paychangu_public_key ?? "");
          setPaychanguConfigured(!!biz.paychangu_secret_key);
          if (Array.isArray(biz.payment_methods)) {
            setPaymentMethods(biz.payment_methods);
          }
        }
      }

      if (waRes.ok) {
        const wa = await waRes.json();
        setWaNumber(wa.linked_number ?? "");
        setWaLinked(!!wa.linked_number);
        setPlatformNumber(wa.platform_number ?? "");
      }

      // Load custom instructions
      try {
        const ciRes = await fetch("/api/data/business-settings");
        if (ciRes.ok) {
          const ci = await ciRes.json();
          setCustomInstructions(ci.custom_instructions || "");
        }
      } catch {}
    } catch (err: any) {
      toast({ title: "Couldn't load settings", description: err.message, variant: "destructive" });
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function saveBusiness() {
    if (!business) return;
    setLoading(true);
    try {
      const res = await fetch("/api/data/business-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bizForm,
          paychangu_secret_key: paychanguSecret || null,
          paychangu_public_key: paychanguPublic || null,
          payment_methods: paymentMethods,
          custom_instructions: customInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setPaychanguConfigured(!!paychanguSecret);
      toast({ title: "Settings saved", description: "Your business settings have been updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function saveWhatsappLink() {
    const clean = waNumber.replace(/[\s+\-]/g, "");
    if (!clean || !/^\d{8,15}$/.test(clean)) {
      toast({ title: "Invalid number", description: "Enter your WhatsApp number with country code (e.g. 265991234567)", variant: "destructive" });
      return;
    }
    setWaSaving(true);
    try {
      const res = await fetch("/api/data/whatsapp-link", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setWaLinked(true); setWaNumber(clean);
      toast({ title: "WhatsApp number linked", description: "You can now message the Finance Manager on WhatsApp." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setWaSaving(false); }
  }

  async function disconnectWhatsapp() {
    setWaSaving(true);
    try {
      const res = await fetch("/api/data/whatsapp-link", { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to disconnect"); }
      setWaLinked(false); setWaNumber("");
      toast({ title: "WhatsApp disconnected", description: "Your number has been unlinked." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setWaSaving(false); }
  }

  function addPaymentMethod() {
    if (paymentMethods.length >= 10) {
      toast({ title: "Limit reached", description: "Maximum 10 payment methods allowed.", variant: "destructive" });
      return;
    }
    setPaymentMethods([...paymentMethods, {
      type: "bank", label: "", account_name: "", account_number: "", bank_name: "", instructions: "",
    }]);
  }

  function updatePaymentMethod(idx: number, field: keyof PaymentMethod, value: string) {
    const updated = [...paymentMethods];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-set label if empty based on type
    if (field === "type" && !updated[idx].label) {
      const typeLabel = paymentMethodTypes.find(t => t.value === value)?.label || "";
      updated[idx].label = typeLabel;
    }
    setPaymentMethods(updated);
  }

  function removePaymentMethod(idx: number) {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== idx));
  }

  if (pageLoading) return (
    <div>
      <Header title="Settings" description="Manage your business settings" icon={Building2} />
      <div className="p-6 flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  const waMeLink = platformNumber ? `https://wa.me/${platformNumber}?text=${encodeURIComponent("Hi! I'd like to manage my finances.")}` : null;

  return (
    <div>
      <Header title="Settings" description="Manage your business settings" icon={Building2} />
      <div className="p-3 sm:p-6 max-w-2xl space-y-6">
        {/* Business Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Business Profile</CardTitle></div>
            <CardDescription>Update your business information shown on invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2"><Label>Business name *</Label><Input value={bizForm.name} onChange={e => setBizForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Business email</Label><Input type="email" value={bizForm.email} onChange={e => setBizForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={bizForm.phone} onChange={e => setBizForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="col-span-2 space-y-2"><Label>Address</Label><Input value={bizForm.address} onChange={e => setBizForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Website</Label><Input placeholder="https://" value={bizForm.website} onChange={e => setBizForm(p => ({ ...p, website: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Tax ID</Label><Input placeholder="Tax registration number" value={bizForm.tax_id} onChange={e => setBizForm(p => ({ ...p, tax_id: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice & Currency */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base">Invoice & Currency</CardTitle></div>
            <CardDescription>Configure invoicing and currency settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Invoice prefix</Label><Input placeholder="INV" value={bizForm.invoice_prefix} onChange={e => setBizForm(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))} /></div>
              <div className="space-y-2 col-span-2"><Label>Currency</Label><Select value={bizForm.currency} onValueChange={v => setBizForm(p => ({ ...p, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="bg-white">{currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 col-span-3"><Label>Business Type</Label><Select value={bizForm.business_type} onValueChange={v => setBizForm(p => ({ ...p, business_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="bg-white">{businessTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </CardContent>
        </Card>

        {/* Paychangu Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Paychangu Configuration</CardTitle>
              {paychanguConfigured ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Configured
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  Not configured
                </span>
              )}
            </div>
            <CardDescription>Configure your Paychangu keys for mobile money invoice payments. This is separate from the platform-level Paychangu used for subscriptions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Paychangu Secret Key</Label>
              <Input type="password" placeholder="sec-..." value={paychanguSecret} onChange={e => setPaychanguSecret(e.target.value)} />
              <p className="text-xs text-muted-foreground">Found in your Paychangu dashboard → API Keys</p>
            </div>
            <div className="space-y-2">
              <Label>Paychangu Public Key (optional)</Label>
              <Input type="password" placeholder="pub-..." value={paychanguPublic} onChange={e => setPaychanguPublic(e.target.value)} />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs text-blue-700">
                When customers pay invoices via mobile money, the payment goes directly to <strong>your</strong> Paychangu account — not Brandfledger's.
                Get your keys at <a href="https://paychangu.com" target="_blank" className="underline">paychangu.com</a>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manual Payment Methods */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Manual Payment Methods</CardTitle>
            </div>
            <CardDescription>Bank accounts and mobile money numbers shown to customers who choose manual payment. Customers will see these with copy buttons, then upload proof of payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No payment methods added yet. Click below to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method, idx) => (
                  <div key={idx} className="rounded-xl border border-input bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Select value={method.type} onValueChange={v => updatePaymentMethod(idx, "type", v)}>
                        <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {paymentMethodTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button onClick={() => removePaymentMethod(idx)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input placeholder="e.g. National Bank" value={method.label} onChange={e => updatePaymentMethod(idx, "label", e.target.value)} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account Name</Label>
                        <Input placeholder="John Doe" value={method.account_name} onChange={e => updatePaymentMethod(idx, "account_name", e.target.value)} className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{method.type === "bank" ? "Account Number" : "Phone Number"}</Label>
                        <Input placeholder={method.type === "bank" ? "1234567890" : "0991234567"} value={method.account_number} onChange={e => updatePaymentMethod(idx, "account_number", e.target.value)} className="text-sm" />
                      </div>
                      {method.type === "bank" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Bank Name</Label>
                          <Input placeholder="National Bank of Malawi" value={method.bank_name} onChange={e => updatePaymentMethod(idx, "bank_name", e.target.value)} className="text-sm" />
                        </div>
                      )}
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Instructions (optional)</Label>
                        <Input placeholder="Use invoice number as reference" value={method.instructions} onChange={e => updatePaymentMethod(idx, "instructions", e.target.value)} className="text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={addPaymentMethod} className="w-full rounded-xl border-2 border-dashed border-input py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              <Plus className="h-4 w-4" /> Add Payment Method
            </button>
          </CardContent>
        </Card>

        {/* Custom Agent Instructions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Agent Instructions</CardTitle>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-medium">
                Customize your WhatsApp Finance Manager
              </span>
            </div>
            <CardDescription>
              Give your Finance Manager custom instructions on how to handle your business. These are injected into every conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Instructions</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={"Examples:\n- Always confirm amounts in USD\n- My business is a graphic design studio\n- Notify me when a customer balance exceeds MK500k\n- Call me 'Boss' instead of by name\n- My financial year starts in April"}
                value={customInstructions}
                onChange={(e) => { setCustomInstructions(e.target.value); setCustomInstructionsSaved(false); }}
              />
              <p className="text-xs text-muted-foreground">
                These instructions are specific to your business and persist across all WhatsApp conversations. They guide the agent on tone, preferences, and business-specific rules.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveBusiness} disabled={loading || !bizForm.name} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Settings
        </Button>

        {/* WhatsApp Assistant */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">WhatsApp Finance Assistant</CardTitle>
              {waLinked ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  Not linked
                </span>
              )}
            </div>
            <CardDescription>Link your WhatsApp number to manage finances via chat</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {waLinked ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Linked: +{waNumber}</p>
                    <p className="text-xs text-green-700 mt-0.5">Send a message to the platform number to start managing your finances.</p>
                  </div>
                </div>
                {waMeLink && (
                  <a href={waMeLink} target="_blank" className="w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white py-2.5 text-sm font-medium hover:bg-green-700">
                    <MessageCircle className="h-4 w-4" /> Open WhatsApp Chat
                  </a>
                )}
                <button onClick={disconnectWhatsapp} disabled={waSaving} className="w-full text-sm text-rose-600 hover:text-rose-700 font-medium py-1">
                  {waSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Disconnect WhatsApp"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    Link your WhatsApp number to chat with the Finance Manager. Send messages like "Record expense MK50,000 for fuel" or "What's my revenue this month?"
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Your WhatsApp Number</Label>
                  <Input placeholder="265991234567" value={waNumber} onChange={e => setWaNumber(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Include country code without + (e.g. 265 for Malawi)</p>
                </div>
                <Button onClick={saveWhatsappLink} disabled={waSaving} className="w-full bg-green-600 hover:bg-green-700">
                  {waSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                  Link WhatsApp Number
                </Button>
                {platformNumber && (
                  <p className="text-xs text-center text-muted-foreground">Platform number: +{platformNumber}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
