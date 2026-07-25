"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BFLogo } from "@/components/bf-logo";
import { Loader2, Mail, Lock, User, Building2, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PERKS = [
  "14-day free trial, no card needed",
  "Unlimited transactions & invoices",
  "Multiple businesses, one account",
  "Works on mobile & desktop",
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Top bar */}
      <header className="h-14 flex items-center px-4 max-w-6xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <BFLogo size={32} className="rounded-lg shadow-sm" />
          <span className="font-bold text-gray-900">Brandfledger</span>
        </Link>
        <div className="w-16" />
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Logo + heading */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              <BFLogo size={64} className="rounded-2xl shadow-lg" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">Start your 14-day free trial today</p>
          </div>

          {/* Perks */}
          <div className="bg-indigo-50 rounded-2xl px-4 py-3 mb-5 space-y-1.5">
            {PERKS.map(p => (
              <div key={p} className="flex items-center gap-2 text-xs text-indigo-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="fullName">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.fullName}
                  onChange={e => set("fullName", e.target.value)}
                  placeholder="John Banda"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Business Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="businessName">Business Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="businessName"
                  type="text"
                  required
                  value={form.businessName}
                  onChange={e => set("businessName", e.target.value)}
                  placeholder="My Business"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 pl-1">Use at least 8 characters with a mix of letters and numbers.</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm mt-1"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Create Free Account"}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-3 text-xs text-gray-400">Already have an account?</span></div>
          </div>

          <Link
            href="/login"
            className="block w-full text-center py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-sm"
          >
            Sign In Instead
          </Link>

          <p className="text-center text-xs text-gray-400 mt-5">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-indigo-600 hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
