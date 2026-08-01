"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink, MessageCircle, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [status, setStatus] = useState<{
    paychangu_configured: boolean;
    whatsapp_configured: boolean;
    openai_configured: boolean;
    whatsapp_number?: string;
  } | null>(null);

  const [form, setForm] = useState({
    paychangu_secret_key: "",
    paychangu_webhook_secret: "",
    resend_api_key: "",
    whatsapp_access_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_verify_token: "",
    whatsapp_app_secret: "",
    whatsapp_number: "",
    openai_api_key: "",
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=settings");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || null);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/data/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "settings", ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast({ title: "Settings saved", description: "Credentials updated successfully." });
      setForm({
        paychangu_secret_key: "", paychangu_webhook_secret: "", resend_api_key: "",
        whatsapp_access_token: "", whatsapp_phone_number_id: "", whatsapp_verify_token: "", whatsapp_app_secret: "", whatsapp_number: "", openai_api_key: "",
      });
      loadSettings();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "";

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Platform Settings</h2>
        <p className="text-sm text-muted-foreground">Manage API credentials and platform integrations.</p>
      </div>

      {/* Status banners */}
      <div className="space-y-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {status?.paychangu_configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Paychangu — Connected</p>
                    <p className="text-xs text-muted-foreground">Payment processing is active.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Paychangu — Not configured</p>
                    <p className="text-xs text-muted-foreground">Payments disabled until credentials are added.</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {status?.whatsapp_configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp Assistant — Connected</p>
                    <p className="text-xs text-muted-foreground">
                      {status?.whatsapp_number ? `Clients message +${status.whatsapp_number}` : "Clients can message the WhatsApp number to manage finances."}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp Assistant — Not configured</p>
                    <p className="text-xs text-muted-foreground">Add WhatsApp Business API credentials below to enable.</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {status?.openai_configured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">OpenAI — Connected</p>
                    <p className="text-xs text-muted-foreground">AI assistant responses are powered by GPT-4o.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">OpenAI — Not configured</p>
                    <p className="text-xs text-muted-foreground">WhatsApp assistant needs an OpenAI API key to respond.</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Paychangu */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Paychangu Credentials</p>
              <a href="https://paychangu.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Get keys <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="paychangu_secret_key" className="text-xs">Secret Key</Label>
              <div className="relative">
                <Input
                  id="paychangu_secret_key"
                  type={showSecret ? "text" : "password"}
                  placeholder={status?.paychangu_configured ? "••••••••••••  (currently set)" : "pk_live_..."}
                  value={form.paychangu_secret_key}
                  onChange={e => setForm(f => ({ ...f, paychangu_secret_key: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paychangu_webhook_secret" className="text-xs">Webhook Secret</Label>
              <div className="relative">
                <Input
                  id="paychangu_webhook_secret"
                  type={showWebhook ? "text" : "password"}
                  placeholder="Webhook signing secret"
                  value={form.paychangu_webhook_secret}
                  onChange={e => setForm(f => ({ ...f, paychangu_webhook_secret: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowWebhook(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook URL: <span className="font-mono bg-muted rounded px-1 py-0.5 text-xs select-all">https://brandfledger-three.vercel.app/api/paychangu/webhook</span>
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp Assistant */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold">WhatsApp Assistant</p>
              </div>
              <a href="https://business.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Get started <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {!status?.whatsapp_configured && (
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Setup steps:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-1">
                  <li>Create a WhatsApp Business account at business.whatsapp.com</li>
                  <li>Get your access token &amp; phone number ID from Meta App Dashboard</li>
                  <li>Enter them below and save</li>
                  <li>Set the webhook URL (shown below) in your Meta App settings</li>
                </ol>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp_access_token" className="text-xs">Meta Access Token</Label>
              <div className="relative">
                <Input
                  id="whatsapp_access_token"
                  type={showWaToken ? "text" : "password"}
                  placeholder={status?.whatsapp_configured ? "••••••••••••  (currently set)" : "EAAG..."}
                  value={form.whatsapp_access_token}
                  onChange={e => setForm(f => ({ ...f, whatsapp_access_token: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowWaToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_phone_number_id" className="text-xs">Phone Number ID</Label>
                <Input
                  id="whatsapp_phone_number_id"
                  placeholder="1234567890"
                  value={form.whatsapp_phone_number_id}
                  onChange={e => setForm(f => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_verify_token" className="text-xs">Webhook Verify Token</Label>
                <Input
                  id="whatsapp_verify_token"
                  placeholder="brandfledger_verify_2026"
                  value={form.whatsapp_verify_token}
                  onChange={e => setForm(f => ({ ...f, whatsapp_verify_token: e.target.value }))}
                  className="font-mono text-sm"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp_app_secret" className="text-xs">Meta App Secret</Label>
              <div className="relative">
                <Input
                  id="whatsapp_app_secret"
                  type={showWaToken ? "text" : "password"}
                  placeholder="Found in Meta App Dashboard → App Settings → Basic"
                  value={form.whatsapp_app_secret}
                  onChange={e => setForm(f => ({ ...f, whatsapp_app_secret: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowWaToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Secures incoming webhooks with HMAC-SHA256 signature verification. Found in Meta App Dashboard → App Settings → Basic → App Secret.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp_number" className="text-xs">WhatsApp Business Number</Label>
              <Input
                id="whatsapp_number"
                placeholder="265991234567"
                value={form.whatsapp_number}
                onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value.replace(/[^\d]/g, "") }))}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">The number clients will message (country code, no +). Used to generate the chat link in client settings.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook URL: <span className="font-mono bg-muted rounded px-1 py-0.5 text-xs select-all">{webhookUrl}</span>
            </p>
          </CardContent>
        </Card>

        {/* OpenAI */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">OpenAI API Key</p>
              </div>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Get key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="openai_api_key" className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  id="openai_api_key"
                  type={showOpenAI ? "text" : "password"}
                  placeholder={status?.openai_configured ? "••••••••••••  (currently set)" : "sk-..."}
                  value={form.openai_api_key}
                  onChange={e => setForm(f => ({ ...f, openai_api_key: e.target.value }))}
                  className="pr-10 font-mono text-sm"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowOpenAI(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Powers the AI assistant's responses on WhatsApp (GPT-4o).</p>
            </div>
          </CardContent>
        </Card>

        {/* Resend (email) */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Email (Resend)</p>
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Get key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="resend_api_key" className="text-xs">Resend API Key</Label>
              <Input
                id="resend_api_key"
                type="password"
                placeholder="re_..."
                value={form.resend_api_key}
                onChange={e => setForm(f => ({ ...f, resend_api_key: e.target.value }))}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Used to send invoice emails to clients.</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save All Settings</>}
        </Button>
      </form>
    </div>
  );
}
