"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    businessName: "",
  });

  // Clear any stale cached data from a previous session
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("cache:") || k === "activeBusinessId")
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "signup") {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Sign up failed", description: data.error, variant: "destructive" });
          setLoading(false);
          return;
        }
        // Clear all old session data
        try {
          Object.keys(localStorage)
            .filter(k => k.startsWith("cache:") || k === "activeBusinessId")
            .forEach(k => localStorage.removeItem(k));
        } catch {}
        toast({ title: "Welcome to Brandfledger!", description: "Your account is ready." });
        window.location.href = "/dashboard";
        return;
      } catch (err: any) {
        toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    // Sign in
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast({ title: "Sign in failed", description: data.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Clear all old session data so new user gets a clean slate
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith("cache:") || k === "activeBusinessId")
          .forEach(k => localStorage.removeItem(k));
      } catch {}

      toast({ title: "Welcome back!" });
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex">
            <img src="/logo.png" alt="Brandfledger" className="h-14 w-14 rounded-2xl shadow-md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Brandfledger</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex rounded-lg border p-1 bg-muted/50">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signin" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="John Doe"
                    value={form.fullName}
                    onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Business Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Your Business Ltd"
                    value={form.businessName}
                    onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                className="pl-10"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                className="pl-10"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary font-medium hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
