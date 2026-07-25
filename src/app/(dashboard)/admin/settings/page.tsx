"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Eye, EyeOff, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [status, setStatus] = useState<{ paychangu_configured: boolean } | null>(null);

  const [form, setForm] = useState({
    paychangu_secret_key: "",
    paychangu_webhook_secret: "",
    resend_api_key: "",
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=settings");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || null);
        // Never pre-fill secrets — just show status
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
      setForm({ paychangu_secret_key: "", paychangu_webhook_secret: "", resend_api_key: "" });
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

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Platform Settings</h2>
        <p className="text-sm text-muted-foreground">Manage API credentials and platform integrations.</p>
      </div>

      {/* Status banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {status?.paychangu_configured ? (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Paychangu — Connected</p>
                  <p className="text-xs text-muted-foreground">Payment processing is active. Update credentials below to change.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Paychangu — Not configured</p>
                  <p className="text-xs text-muted-foreground">Payments are disabled until you add your Paychangu credentials.</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Paychangu */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Paychangu Credentials</p>
              <a
                href="https://paychangu.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
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
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
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
                <button
                  type="button"
                  onClick={() => setShowWebhook(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Webhook URL to set in Paychangu dashboard:{" "}
              <span className="font-mono bg-muted rounded px-1 py-0.5 text-xs select-all">
                https://brandfledger-three.vercel.app/api/paychangu/webhook
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Resend (email) */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Email (Resend)</p>
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
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
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
        </Button>
      </form>
    </div>
  );
}
