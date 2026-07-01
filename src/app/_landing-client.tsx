"use client";
import Link from "next/link";
import {
  FileText, Receipt, Users, BarChart3,
  Package, CreditCard, ArrowRight, Check, Zap,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Smart Invoicing",
    desc: "Create professional invoices in seconds. Auto-numbered, tax-ready, and emailable straight from the dashboard.",
  },
  {
    icon: Package,
    title: "Product Catalog",
    desc: "Build your catalog once. Pick items on any invoice and prices fill in automatically.",
  },
  {
    icon: BarChart3,
    title: "Live Reports",
    desc: "Revenue, expenses, and profit at a glance — broken down by month or category, exportable to CSV.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    desc: "Keep every client's details, billing history, and invoices in one clean place.",
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    desc: "Log what you spend, by category and vendor. See the full picture of your profit margin.",
  },
  {
    icon: CreditCard,
    title: "Payment Records",
    desc: "Record payments against invoices. Statuses update automatically when the bill is settled.",
  },
];

const perks = [
  "No spreadsheets, no chaos",
  "Free to start — no credit card",
  "Works for any type of business",
  "Built with African markets in mind",
];

const stats = [
  { value: "2,400+", label: "Businesses" },
  { value: "$12M+", label: "Invoiced" },
  { value: "99.9%", label: "Uptime" },
];

export default function LandingClient() {
  return (
    <div className="min-h-screen" style={{ background: "#0a0b10", color: "#fff" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(10,11,16,0.85)", backdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">Brandfledger</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-colors" style={{ color: "#94a3b8" }}>
              Sign in
            </Link>
            <Link href="/register" className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
          Business Operating System
        </div>

        <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight mb-5" style={{ letterSpacing: "-0.03em" }}>
          Run your business<br />
          <span style={{ background: "linear-gradient(90deg,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            like you mean it.
          </span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "#94a3b8" }}>
          Invoices, expenses, customers, reports — everything a small business needs, in one clean dashboard. No accountant required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link href="/register" className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-base transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 0 32px rgba(99,102,241,0.35)" }}>
            Create free workspace <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login" className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-medium text-sm transition-colors" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }}>
            Already have an account
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-10 sm:gap-16">
          {stats.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-black">{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-5xl mx-auto px-5 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black tracking-tight mb-3" style={{ letterSpacing: "-0.02em" }}>Everything in one place</h2>
          <p className="text-base" style={{ color: "#64748b" }}>Replace the spreadsheets, the chaos, and the guesswork.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl p-5 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(99,102,241,0.15)" }}>
                <Icon className="w-4 h-4" style={{ color: "#818cf8" }} />
              </div>
              <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PERKS ── */}
      <section className="max-w-5xl mx-auto px-5 pb-20">
        <div className="rounded-2xl p-8 sm:p-10" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div className="sm:flex items-center justify-between gap-8">
            <div className="mb-6 sm:mb-0">
              <h2 className="text-2xl font-black tracking-tight mb-2" style={{ letterSpacing: "-0.02em" }}>Built for real businesses.</h2>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b", maxWidth: "360px" }}>
                Brandfledger was designed from the ground up for small businesses — especially in markets where most tools weren't built for you.
              </p>
            </div>
            <ul className="flex flex-col gap-3 shrink-0">
              {perks.map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }}>
                    <Check className="w-3 h-3" style={{ color: "#818cf8" }} />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="max-w-5xl mx-auto px-5 pb-24 text-center">
        <h2 className="text-4xl font-black tracking-tight mb-4" style={{ letterSpacing: "-0.03em" }}>
          Ready to take control?
        </h2>
        <p className="text-base mb-8" style={{ color: "#64748b" }}>
          Join thousands of businesses running smarter with Brandfledger. Free to start.
        </p>
        <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-base transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 0 40px rgba(99,102,241,0.3)" }}>
          Create free workspace <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold">Brandfledger</span>
          </div>
          <p className="text-xs" style={{ color: "#475569" }}>© {new Date().getFullYear()} Brandfledger. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
