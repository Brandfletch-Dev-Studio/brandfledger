"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { BFLogo } from "@/components/bf-logo";
import {
  TrendingUp, FileText, BarChart3, ArrowRight, CheckCircle2,
  Menu, X, Users, ShieldCheck, Zap, Star, ChevronRight,
  Receipt, PieChart, Smartphone, MessageCircle,
} from "lucide-react";

// ── Static data ────────────────────────────────────────────────────────────────
const PAIN_POINTS = [
  { icon: "⏰", text: "Forgetting to bill clients for hours you actually worked" },
  { icon: "😩", text: "Not knowing which clients are profitable and which drain your time" },
  { icon: "📝", text: "Writing invoices manually in WhatsApp or notebooks" },
  { icon: "🤔", text: "Having no idea what your effective hourly rate really is" },
];

const FEATURES = [
  {
    icon: MessageCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "WhatsApp Finance Manager",
    body: "Log time, record income, send invoices — all from WhatsApp. No app to open. Just message and it's done.",
  },
  {
    icon: TrendingUp,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    title: "Time Tracking & WIP",
    body: "Log billable hours per client. See exactly how much work is unbilled. Invoice it in one message.",
  },
  {
    icon: Receipt,
    color: "text-amber-600",
    bg: "bg-amber-50",
    title: "Professional Invoices",
    body: "Create a branded invoice in under 60 seconds. Send via WhatsApp or link. Get paid faster.",
  },
  {
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-50",
    title: "Client Profitability",
    body: "See which clients make you money and which drain your time. Revenue, hours, effective rate — per client.",
  },
  {
    icon: PieChart,
    color: "text-rose-600",
    bg: "bg-rose-50",
    title: "Business Reports",
    body: "Revenue, expenses, profit — all in clear charts. No accountant needed. Understand your money.",
  },
  {
    icon: Smartphone,
    color: "text-sky-600",
    bg: "bg-sky-50",
    title: "Built for Mobile",
    body: "Designed for your phone. Install it like an app. Works everywhere — even with slow internet.",
  },
];

const TESTIMONIALS = [
  {
    name: "Takondwa M.",
    role: "Branding Studio, Lilongwe",
    text: "Before Brandfledger, I had no idea which clients were actually profitable. Now I track my hours, see my effective rate, and invoice in seconds.",
    stars: 5,
  },
  {
    name: "James C.",
    role: "IT Consultant, Blantyre",
    text: "I just WhatsApp 'spent 3 hours on ABC Ltd at 50k per hour' and it's logged. When it's time to invoice, one message and it's done. Game changer.",
    stars: 5,
  },
  {
    name: "Grace N.",
    role: "Design Agency, Mzuzu",
    text: "The unbilled work alerts saved me. I was sitting on MK750k of work I forgot to invoice. Brandfledger caught it.",
    stars: 5,
  },
];

const PLAN_FEATURES = [
  "Unlimited invoices",
  "Time tracking & WIP management",
  "Client profitability analytics",
  "WhatsApp Finance Manager",
  "Business reports & charts",
  "Multiple businesses",
  "14-day free trial",
  "Mobile app (installable)",
];

// ── Components ─────────────────────────────────────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const step = target / 40;
    const t = setInterval(() => {
      setVal(v => { const next = v + step; if (next >= target) { clearInterval(t); return target; } return next; });
    }, 30);
    return () => clearInterval(t);
  }, [target]);
  return <>{Math.floor(val)}{suffix}</>;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LandingClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BFLogo size={32} className="rounded-lg" />
            <span className="font-bold text-base tracking-tight">Brandfledger</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-indigo-600 transition-colors">Reviews</a>
            <Link href="/login" className="text-gray-700 hover:text-indigo-600 transition-colors">Sign in</Link>
            <Link href="/register"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors">
              Try free →
            </Link>
          </div>
          <button className="md:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
            {["#features", "#pricing", "#testimonials"].map(h => (
              <a key={h} href={h} onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 capitalize">{h.slice(1)}</a>
            ))}
            <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700">Sign in</Link>
            <Link href="/register" onClick={() => setMenuOpen(false)}
              className="block bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold text-center">
              Start free trial →
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 px-4 text-center bg-gradient-to-b from-indigo-50/60 to-white">
        <div className="max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" />
            14-day free trial · No credit card needed
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-gray-900 mb-5">
            The Finance App Built for{" "}
            <span className="text-indigo-600">Service<br className="hidden sm:block" /> Businesses</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Track billable hours, send professional invoices, and see which clients actually make you money —
            all from WhatsApp. Built for Malawian service businesses.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Link href="/register"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
              Start free — 14 days <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto border border-gray-200 text-gray-700 font-semibold px-8 py-4 rounded-2xl text-base hover:bg-gray-50 transition-colors">
              Sign in
            </Link>
          </div>

          {/* Social proof bar */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 flex-wrap">
            <Stars count={5} />
            <span className="font-semibold text-gray-700">Trusted by 100+ service businesses</span>
            <span>·</span>
            <span>MK 15,000/month</span>
          </div>
        </div>

        {/* Floating stats */}
        <div className="mt-14 grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            { val: 500, suffix: "+", label: "Invoices sent" },
            { val: 100, suffix: "+", label: "Businesses" },
            { val: 14, suffix: " days", label: "Free trial" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">
                <CountUp target={s.val} suffix={s.suffix} />
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain points ── */}
      <section className="py-16 px-4 bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Sound familiar?</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-10">
            Running a service business is hard enough —<br />
            <span className="text-indigo-400">your time and money shouldn't be a mystery.</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {PAIN_POINTS.map(p => (
              <div key={p.text} className="flex items-start gap-3 bg-white/5 rounded-2xl p-4">
                <span className="text-2xl shrink-0">{p.icon}</span>
                <p className="text-sm text-gray-300 leading-snug">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-lg font-semibold text-white">
            Brandfledger fixes all of this — <span className="text-indigo-400">in minutes.</span>
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Everything your service business needs.
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              No spreadsheets. No complexity. Just WhatsApp and a clean app that keeps your service business running.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className={`h-10 w-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-4 bg-indigo-50">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Dead simple</p>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-12">Up and running in 3 steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Create your account", body: "Sign up free. Set up your business in under 2 minutes. No card needed." },
              { step: "2", title: "Add services & clients", body: "Set up your service packages and client list. One time setup — use forever." },
              { step: "3", title: "Track time & get paid", body: "Log hours on WhatsApp, invoice unbilled work, and see your profit per client." },
            ].map(s => (
              <div key={s.step} className="relative">
                <div className="h-12 w-12 rounded-full bg-indigo-600 text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                  {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Real businesses, real results</p>
            <h2 className="text-3xl font-extrabold text-gray-900">Business owners love Brandfledger</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <Stars count={t.stars} />
                <p className="mt-3 text-sm text-gray-700 leading-relaxed italic">"{t.text}"</p>
                <div className="mt-4 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 px-4 bg-gray-950 text-white">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Simple pricing</p>
          <h2 className="text-3xl font-extrabold mb-2">One plan. Everything included.</h2>
          <p className="text-gray-400 mb-8">No hidden fees. No per-invoice charges. Just one flat rate.</p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${billing === "monthly" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${billing === "annual" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
              Annual <span className="text-xs text-emerald-400 font-bold ml-1">Save 17%</span>
            </button>
          </div>

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-left">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-extrabold text-white">
                {billing === "monthly" ? "MK 15,000" : "MK 12,500"}
              </span>
              <span className="text-gray-400 pb-1">/month</span>
            </div>
            {billing === "annual" && (
              <p className="text-xs text-emerald-400 font-semibold mb-1">Billed MK 150,000/year · Save MK 30,000</p>
            )}
            <p className="text-gray-400 text-sm mb-6">Everything you need to run your business finances.</p>

            <div className="space-y-3 mb-8">
              {PLAN_FEATURES.map(feat => (
                <div key={feat} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-200">{feat}</span>
                </div>
              ))}
            </div>

            <Link href="/register"
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl text-center transition-colors text-base">
              Start your free 14-day trial →
            </Link>
            <p className="text-center text-xs text-gray-500 mt-3">No credit card required to start.</p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4 bg-indigo-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Ready to take control of your service business?
          </h2>
          <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
            Join 100+ Malawian service businesses who track time, send invoices, and get paid faster.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-8 py-4 rounded-2xl text-base hover:bg-indigo-50 transition-colors shadow-xl">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-indigo-200 text-sm mt-4">14-day free trial · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-gray-400 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2">
              <BFLogo size={28} className="rounded-lg" />
              <div>
                <p className="text-white font-bold text-sm">Brandfledger</p>
                <p className="text-xs text-gray-500">Business finance, simplified.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
              <Link href="/register" className="hover:text-white transition-colors">Register</Link>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <p>© {new Date().getFullYear()} Brandfledger. All rights reserved.</p>
            <div className="flex items-center gap-1 text-gray-500">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Made for Malawian businesses</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
