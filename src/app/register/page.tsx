"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BFLogo } from "@/components/bf-logo";
import { Loader2, Mail, Lock, User, Building2, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PERKS = [
  "14-day free trial · no card needed",
  "Invoices, expenses & profit tracking",
  "Multiple businesses, one account",
];

export default function RegisterPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", businessName: "" });

  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith("cache:") || k === "activeBusinessId")
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const pwStrength = form.password.length === 0 ? 0
    : form.password.length < 6 ? 1
    : form.password.length < 10 ? 2 : 3;
  const pwColors = ["", "bg-destructive", "bg-amber-500", "bg-emerald-500"];
  const pwLabels = ["", "Too short", "Could be stronger", "Strong"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.fullName || !form.businessName) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Sign up failed", description: data.error || "Could not create account.", variant: "destructive" });
        setLoading(false);
        return;
      }
      try { localStorage.clear(); } catch {}
      router.push("/dashboard");
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  }

  const fields = [
    { id: "fullName",     label: "Full Name",     icon: User,      type: "text",     placeholder: "Arthur Chibondo",     autocomplete: "name"          },
    { id: "businessName", label: "Business Name", icon: Building2, type: "text",     placeholder: "Acme Agency",         autocomplete: "organization"  },
    { id: "email",        label: "Email",         icon: Mail,      type: "email",    placeholder: "you@example.com",     autocomplete: "email"         },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand */}
          <div className="flex items-center gap-3 mb-6">
            <BFLogo size={44} className="rounded-xl shadow-md" />
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Brandfledger</p>
              <h1 className="text-xl font-black text-foreground leading-tight">Get started free</h1>
            </div>
          </div>

          {/* Perks strip */}
          <div className="flex flex-col gap-1 mb-5 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
            {PERKS.map(p => (
              <div key={p} className="flex items-center gap-2 text-xs text-primary font-medium">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {p}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {fields.map(({ id, label, icon: Icon, type, placeholder, autocomplete }) => (
              <div key={id}>
                <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor={id}>{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id={id}
                    type={type}
                    autoComplete={autocomplete}
                    required
                    value={(form as any)[id]}
                    onChange={e => set(id, e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition-all shadow-sm"
                  />
                </div>
              </div>
            ))}

            {/* Password with strength */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength ? pwColors[pwStrength] : "bg-border"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{pwLabels[pwStrength]}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-bold text-sm transition-all shadow-md active:scale-[0.98]"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
                : <><span>Create my workspace</span><ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Have an account?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-border bg-background hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
          >
            Sign in instead
          </Link>

          <p className="text-center text-[11px] text-muted-foreground mt-4">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
