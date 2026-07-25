"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BFLogo } from "@/components/bf-logo";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

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
    if (!form.email || !form.password) {
      toast({ title: "Missing fields", description: "Please enter your email and password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Sign in failed", description: data.error || "Invalid credentials.", variant: "destructive" });
        setLoading(false);
        return;
      }
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
        <div className="w-16" /> {/* spacer */}
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Logo + heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <BFLogo size={64} className="rounded-2xl shadow-lg" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your Brandfledger account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">Email address</label>
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700" htmlFor="password">Password</label>
                <button type="button" className="text-xs text-indigo-600 hover:underline" tabIndex={-1}>Forgot password?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="••••••••"
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm mt-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-3 text-xs text-gray-400">Don't have an account?</span></div>
          </div>

          <Link
            href="/register"
            className="block w-full text-center py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-sm"
          >
            Create a free account
          </Link>

          <p className="text-center text-xs text-gray-400 mt-6">
            By signing in you agree to our{" "}
            <Link href="/terms" className="text-indigo-600 hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
