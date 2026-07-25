"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Lock, LogOut, Shield, ChevronRight, Building2, Check, Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { clearAllCaches } from "@/hooks/use-cached-fetch";

const currencies = ["MWK", "USD", "EUR", "GBP", "ZAR", "NGN", "KES", "GHS", "CAD", "AUD", "TZS", "UGX", "RWF"];

export default function AccountPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Password change form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [showAddBiz, setShowAddBiz] = useState(false);
  const [addBizForm, setAddBizForm] = useState({ name: "", currency: "MWK", invoice_prefix: "INV" });
  const [addBizSaving, setAddBizSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, bizRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/data/businesses"),
      ]);
      if (meRes.ok) {
        const d = await meRes.json();
        setProfile(d.user);
      }
      if (bizRes.ok) {
        const d = await bizRes.json();
        setBusinesses(d.businesses || []);
      }
      setActiveId(localStorage.getItem("activeBusinessId"));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSignOut() {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch {}
    clearAllCaches();
    try { localStorage.clear(); } catch {}
    window.location.href = "/auth";
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (pwForm.next.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Password changed successfully" });
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPwSaving(false);
  }

  async function handleAddBusiness() {
    if (!addBizForm.name.trim()) return;
    setAddBizSaving(true);
    try {
      const res = await fetch("/api/data/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addBizForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Business created!", description: data.business.name });
      setBusinesses(prev => [...prev, data.business]);
      clearAllCaches();
      localStorage.setItem("activeBusinessId", data.business.id);
      setActiveId(data.business.id);
      setAddBizForm({ name: "", currency: "MWK", invoice_prefix: "INV" });
      setShowAddBiz(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAddBizSaving(false);
  }

  function switchBusiness(id: string) {
    clearAllCaches();
    localStorage.setItem("activeBusinessId", id);
    setActiveId(id);
    toast({ title: "Switched business" });
    router.refresh();
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-3 sm:p-6 max-w-xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
          {profile?.email?.slice(0, 2).toUpperCase() || "??"}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{profile?.fullName || profile?.email?.split("@")[0]}</h1>
          <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
        </div>
      </div>

      {/* Businesses */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">My Businesses</p>
            </div>
            <button
              onClick={() => setShowAddBiz(true)}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>

          {businesses.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No businesses yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {businesses.map(b => {
                const isActive = b.id === activeId;
                return (
                  <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${isActive ? "bg-primary/5" : ""}`}>
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.currency} · {b.subscription_status || "trial"}</p>
                    </div>
                    {isActive ? (
                      <div className="flex items-center gap-1 text-xs text-primary font-medium">
                        <Check className="h-3.5 w-3.5" /> Active
                      </div>
                    ) : (
                      <button
                        onClick={() => switchBusiness(b.id)}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardContent className="p-0 divide-y">
          <button
            onClick={() => router.push("/settings")}
            className="flex items-center justify-between w-full px-4 py-3.5 text-sm hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Business Settings</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => router.push("/subscription")}
            className="flex items-center justify-between w-full px-4 py-3.5 text-sm hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Subscription & Billing</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Change Password</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Current password</Label>
              <Input
                type="password"
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New password</Label>
              <Input
                type="password"
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm new password</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat new password"
                required
              />
            </div>
            <Button type="submit" disabled={pwSaving} className="w-full" size="sm">
              {pwSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign out
      </Button>

      {/* Add Business Sheet */}
      {showAddBiz && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddBiz(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border bg-card shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-200 sm:animate-none">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">New business</h2>
                <p className="text-sm text-muted-foreground">Each business has its own data & invoices</p>
              </div>
              <button onClick={() => setShowAddBiz(false)} className="p-2 rounded-xl hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Business name *</Label>
                <Input
                  placeholder="e.g. Hamaz Boreholes Ltd"
                  value={addBizForm.name}
                  onChange={e => setAddBizForm(p => ({ ...p, name: e.target.value }))}
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleAddBusiness()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Currency</Label>
                  <select
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={addBizForm.currency}
                    onChange={e => setAddBizForm(p => ({ ...p, currency: e.target.value }))}
                  >
                    {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Invoice prefix</Label>
                  <Input
                    placeholder="INV"
                    maxLength={6}
                    value={addBizForm.invoice_prefix}
                    onChange={e => setAddBizForm(p => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddBiz(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={handleAddBusiness}
                disabled={addBizSaving || !addBizForm.name.trim()}
              >
                {addBizSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {addBizSaving ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
