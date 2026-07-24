"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2 } from "lucide-react";
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
  const [business, setBusiness] = useState<any>(null);
  const [bizForm, setBizForm] = useState({
    name: "", email: "", phone: "", address: "", website: "",
    currency: "USD", invoice_prefix: "INV", business_type: "other", tax_id: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const sb = createClient();
    const { data: biz, error } = await getDefaultBusiness(sb);
    if (error) {
      toast({ title: "Couldn't load business settings", description: error.message, variant: "destructive" });
      return;
    }
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

  async function saveBusiness() {
    if (!business) return;
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.from("businesses").update({
      name: bizForm.name, email: bizForm.email, phone: bizForm.phone,
      address: bizForm.address, website: bizForm.website,
      currency: bizForm.currency, invoice_prefix: bizForm.invoice_prefix,
      business_type: bizForm.business_type, tax_id: bizForm.tax_id,
      updated_at: new Date().toISOString(),
    }).eq("id", business.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Settings saved", description: "Your business settings have been updated." });
    setLoading(false);
  }

  return (
    <div>
      <Header title="Settings" description="Manage your business settings" icon={Building2} />
      <div className="p-6 max-w-2xl space-y-6">
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
              <div className="space-y-2 col-span-2"><Label>Currency</Label><Select value={bizForm.currency} onValueChange={v => setBizForm(p => ({ ...p, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 col-span-3"><Label>Business Type</Label><Select value={bizForm.business_type} onValueChange={v => setBizForm(p => ({ ...p, business_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{businessTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={saveBusiness} disabled={loading || !bizForm.name} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
