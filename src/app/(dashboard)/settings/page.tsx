"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, MessageCircle, Key, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
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

  // WhatsApp settings
  const [whatsappForm, setWhatsappForm] = useState({
    whatsapp_number: "",
    whatsapp_access_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_verify_token: "",
    openai_api_key: "",
  });
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const [bizRes, waRes] = await Promise.all([
        fetch("/api/data/customers"),
        fetch("/api/data/whatsapp-settings"),
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
        setWhatsappForm({
          whatsapp_number: wa.whatsapp_number ?? "",
          whatsapp_access_token: wa.whatsapp_access_token ?? "",
          whatsapp_phone_number_id: wa.whatsapp_phone_number_id ?? "",
          whatsapp_verify_token: wa.whatsapp_verify_token ?? "",
          openai_api_key: wa.openai_api_key ?? "",
        });
        setWhatsappConnected(!!(wa.whatsapp_access_token && wa.whatsapp_phone_number_id));
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

  async function saveWhatsapp() {
    setLoading(true);
    try {
      const res = await fetch("/api/data/whatsapp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(whatsappForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setWhatsappConnected(!!(whatsappForm.whatsapp_access_token && whatsappForm.whatsapp_phone_number_id));
      toast({
        title: "WhatsApp settings saved",
        description: whatsappConnected
          ? "WhatsApp configuration updated."
          : "WhatsApp configured! Set the webhook URL in your Meta dashboard to complete setup.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
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

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "";

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
              <CardTitle className="text-base">WhatsApp Assistant</CardTitle>
              {whatsappConnected ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  <AlertCircle className="h-3.5 w-3.5" /> Not configured
                </span>
              )}
            </div>
            <CardDescription>
              Connect WhatsApp to let clients record transactions and check finances via chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection status banner */}
            {!whatsappConnected && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Setup steps:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Create a WhatsApp Business account at <a href="https://business.whatsapp.com/" target="_blank" rel="noopener" className="text-primary underline">business.whatsapp.com</a></li>
                  <li>Get your access token &amp; phone number ID from Meta App Dashboard</li>
                  <li>Enter them below and save</li>
                  <li>Set the webhook URL (shown below) in your Meta App settings</li>
                </ol>
              </div>
            )}

            <div className="space-y-2">
              <Label>WhatsApp Business Number</Label>
              <Input
                placeholder="265991234567"
                value={whatsappForm.whatsapp_number}
                onChange={e => setWhatsappForm(p => ({ ...p, whatsapp_number: e.target.value.replace(/[^\d]/g, "") }))}
              />
              <p className="text-xs text-muted-foreground">The number clients will message (country code, no +)</p>
            </div>

            <div className="space-y-2">
              <Label>Meta Access Token</Label>
              <Input
                type="password"
                placeholder="EAAG..."
                value={whatsappForm.whatsapp_access_token}
                onChange={e => setWhatsappForm(p => ({ ...p, whatsapp_access_token: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="1234567890"
                  value={whatsappForm.whatsapp_phone_number_id}
                  onChange={e => setWhatsappForm(p => ({ ...p, whatsapp_phone_number_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook Verify Token</Label>
                <Input
                  placeholder="brandfledger_verify_2026"
                  value={whatsappForm.whatsapp_verify_token}
                  onChange={e => setWhatsappForm(p => ({ ...p, whatsapp_verify_token: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>OpenAI API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={whatsappForm.openai_api_key}
                onChange={e => setWhatsappForm(p => ({ ...p, openai_api_key: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Used to power the AI assistant's responses</p>
            </div>

            {/* Webhook URL (read-only) */}
            <div className="space-y-2">
              <Label>Webhook URL (copy this to Meta Dashboard)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                In Meta App Dashboard → WhatsApp → Configuration → Webhook, paste this URL and use your verify token
              </p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveWhatsapp} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save WhatsApp Settings
        </Button>
      </div>
    </div>
  );
}
