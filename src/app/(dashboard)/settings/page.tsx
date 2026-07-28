"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, MessageCircle, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
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

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [bizForm, setBizForm] = useState({
    name: "", email: "", phone: "", address: "", website: "",
    currency: "USD", invoice_prefix: "INV", business_type: "other", tax_id: "",
  });

  // WhatsApp link state
  const [waNumber, setWaNumber] = useState("");
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
        }
      }

      if (waRes.ok) {
        const wa = await waRes.json();
        setWaNumber(wa.linked_number ?? "");
        setWaLinked(!!wa.linked_number);
        setPlatformNumber(wa.platform_number ?? "");
      }
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
        body: JSON.stringify(bizForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp_number: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setWaLinked(true);
      setWaNumber(clean);
      toast({ title: "WhatsApp number linked", description: "You can now message the Finance Manager on WhatsApp." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setWaSaving(false);
    }
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

        <Button onClick={saveBusiness} disabled={loading || !bizForm.name} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Business Settings
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
                  <AlertCircle className="h-3.5 w-3.5" /> Not linked
                </span>
              )}
            </div>
            <CardDescription>
              Record transactions, create invoices, and check your finances — all by chatting on WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Your WhatsApp Number</Label>
              <Input
                placeholder="265991234567"
                value={waNumber}
                onChange={e => setWaNumber(e.target.value.replace(/[^\d]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">Enter the number you use on WhatsApp (country code, no +)</p>
            </div>

            <Button onClick={saveWhatsappLink} disabled={waSaving} variant="outline" className="w-full">
              {waSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              {waLinked ? "Update Number" : "Link My WhatsApp"}
            </Button>

            {waLinked && waMeLink && (
              <a href={waMeLink} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat with Finance Assistant
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Button>
              </a>
            )}

            {waLinked && !waMeLink && (
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">WhatsApp Assistant is being set up.</p>
                <p>The chat link will appear here once the platform number is configured. Check back soon!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
