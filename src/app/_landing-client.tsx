"use client";
import Link from "next/link";
import { useState } from "react";
import { BFLogo } from "@/components/bf-logo";
import {
  TrendingUp, FileText, BarChart3, ArrowRight,
  CheckCircle2, Menu, X, Users, ShieldCheck,
  Zap, Globe, Mail, Phone,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
];

const FEATURES = [
  {
    icon: TrendingUp,
    color: "bg-green-50 text-green-600",
    title: "Profit Tracking",
    body: "See your exact profit on every sale. Set custom costs per product and watch your margins in real time.",
  },
  {
    icon: FileText,
    color: "bg-indigo-50 text-indigo-600",
    title: "Professional Invoices",
    body: "Create branded invoices in seconds. Share via link or PDF. Mark paid with one tap.",
  },
  {
    icon: BarChart3,
    color: "bg-amber-50 text-amber-600",
    title: "Business Reports",
    body: "Monthly revenue, expenses, and profit charts. Understand your business at a glance.",
  },
  {
    icon: Users,
    color: "bg-purple-50 text-purple-600",
    title: "Client Management",
    body: "Keep a full record of your clients, their orders, and lifetime value — all in one place.",
  },
  {
    icon: ShieldCheck,
    color: "bg-rose-50 text-rose-600",
    title: "Multi-Business",
    body: "Manage multiple businesses under one account. Separate books, one subscription.",
  },
  {
    icon: Zap,
    color: "bg-sky-50 text-sky-600",
    title: "Mobile First",
    body: "Built for your phone. Works offline. Feels like a native app when installed.",
  },
];

const PLAN = {
  monthly: "MK 15,000",
  annual: "MK 150,000",
  features: [
    "Unlimited businesses",
    "Unlimited transactions & invoices",
    "Profit-per-sale tracking",
    "Client management",
    "Business reports & exports",
    "Priority support",
  ],
};

export default function LandingClient() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <BFLogo size={36} className="rounded-xl shadow-sm" />
            <span className="font-bold text-lg tracking-tight">Brandfledger</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">{l.label}</a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shadow-sm">
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="block py-2.5 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}
                className="block text-center py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Sign In
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}
                className="block text-center py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col">

        {/* ── HERO ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
          <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
              🎉 14-day free trial — no card required
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Run your business<br />
              <span className="text-indigo-600">like a pro.</span>
            </h1>

            <p className="text-base sm:text-xl text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
              Brandfledger gives small businesses in Malawi a complete financial dashboard —
              invoices, expenses, profit tracking, and client management, all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
              <Link href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg transition-colors text-base">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold shadow-sm transition-colors text-base">
                See How It Works
              </a>
            </div>

            <p className="mt-5 text-xs text-gray-400">No credit card. Cancel anytime. Takes 60 seconds to sign up.</p>
          </div>
        </section>

        {/* ── SOCIAL PROOF ── */}
        <section className="border-y border-gray-100 bg-white py-8">
          <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span>Works on any phone</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span>MK billing — no forex</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span>Secure & private</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /><span>Multiple businesses</span></div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-16 sm:py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-2">Features</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Everything you need to grow</h2>
              <p className="mt-3 text-gray-500 max-w-xl mx-auto">Built specifically for small businesses in Malawi — no bloat, no complexity.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(f => (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="py-16 sm:py-24 bg-gray-50">
          <div className="max-w-2xl mx-auto px-4">
            <div className="text-center mb-10">
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-2">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">One plan. Everything included.</h2>
              <p className="mt-3 text-gray-500">14-day free trial. No card needed. Cancel anytime.</p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden">
              {/* Header band */}
              <div className="bg-indigo-600 text-white text-center py-4">
                <span className="text-xs font-bold bg-white/20 rounded-full px-3 py-1">14-day free trial</span>
              </div>

              {/* Price */}
              <div className="text-center pt-8 pb-6 px-6">
                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className="text-5xl font-extrabold text-gray-900">{PLAN.monthly}</span>
                  <span className="text-lg text-gray-400 mb-2">/month</span>
                </div>
                <p className="text-sm text-gray-500">
                  or <span className="font-semibold text-gray-700">{PLAN.annual}</span>/year <span className="text-green-600 font-medium">(save 2 months)</span>
                </p>
              </div>

              {/* Features */}
              <div className="px-6 pb-2">
                <ul className="space-y-3">
                  {PLAN.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTAs */}
              <div className="p-6 space-y-3">
                <Link href="/register"
                  className="block w-full text-center py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors shadow-sm">
                  Start Free Trial
                </Link>
                <p className="text-center text-xs text-gray-400">No credit card required · Cancel anytime</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="bg-indigo-600 py-14 sm:py-20">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to take control?</h2>
            <p className="text-indigo-200 mb-8 text-base">Join hundreds of businesses already using Brandfledger to manage their finances.</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-indigo-600 font-bold text-base hover:bg-indigo-50 transition-colors shadow-lg">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer id="about" className="bg-gray-900 text-gray-300">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          {/* Top grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 pb-10 border-b border-gray-800">

            {/* Brand col */}
            <div className="sm:col-span-1 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <BFLogo size={40} className="rounded-xl" />
                <span className="font-bold text-white text-lg">Brandfledger</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                The financial operating system for small businesses in Malawi and beyond.
              </p>
              <div className="flex gap-3 mt-1">
                <a href="mailto:hello@brandfledger.com"
                  className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-indigo-600 flex items-center justify-center transition-colors" title="Email">
                  <Mail className="w-4 h-4" />
                </a>
                <a href="tel:+265999000000"
                  className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-indigo-600 flex items-center justify-center transition-colors" title="Phone">
                  <Phone className="w-4 h-4" />
                </a>
                <a href="https://brandfledger-three.vercel.app" target="_blank" rel="noreferrer"
                  className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-indigo-600 flex items-center justify-center transition-colors" title="Website">
                  <Globe className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            <div>
              <p className="font-semibold text-white text-sm mb-4">Product</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Start Free Trial</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-white text-sm mb-4">Platform</p>
              <ul className="space-y-3 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Invoices</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Reports</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Client Management</Link></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-white text-sm mb-4">Support</p>
              <ul className="space-y-3 text-sm">
                <li><a href="mailto:hello@brandfledger.com" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link></li>
                <li><a href="mailto:hello@brandfledger.com" className="hover:text-white transition-colors">Report a Bug</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Brandfledger. All rights reserved.</p>
            <p className="flex items-center gap-1">Built with <span className="text-red-400">♥</span> for small businesses in Malawi</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
