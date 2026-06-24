"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// ─── Slide definitions ────────────────────────────────────────────────────────
const slides = [
  { id: "hero" },
  { id: "features" },
  { id: "cta" },
];

// ─── Slide 1: Hero ────────────────────────────────────────────────────────────
function SlideHero() {
  return (
    <div className="flex flex-col items-center justify-between h-full px-6 pt-16 pb-6 text-center">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-xl tracking-tight">BF</span>
          </div>
          <span className="text-white text-2xl font-bold tracking-tight">Brandfledger</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10">
          <span className="text-indigo-400 text-xs font-semibold tracking-widest uppercase">Business Operating System</span>
        </div>
      </div>

      {/* Hero text */}
      <div className="flex flex-col items-center gap-4 flex-1 justify-center">
        <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
          Run your<br />business<br />
          <span className="text-indigo-400">like a pro.</span>
        </h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-xs">
          Invoices, expenses, customers, and live reports — everything you need to run a smarter, more profitable business.
        </p>

        {/* Stats */}
        <div className="flex items-center gap-8 mt-2">
          {[["500+", "Businesses"], ["12k+", "Invoices Sent"], ["99%", "Uptime"]].map(([v, l]) => (
            <div key={l} className="flex flex-col items-center gap-0.5">
              <span className="text-white text-xl font-bold">{v}</span>
              <span className="text-slate-500 text-xs">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full">
        <Link href="/register" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-colors shadow-lg shadow-indigo-600/30">
          Create free workspace <span className="text-lg">→</span>
        </Link>
        <Link href="/login" className="flex items-center justify-center w-full py-4 rounded-2xl border border-slate-600 bg-slate-800/50 text-white font-medium text-base hover:bg-slate-700/50 transition-colors">
          Log in to my account
        </Link>
      </div>
    </div>
  );
}

// ─── Slide 2: Features ────────────────────────────────────────────────────────
const features = [
  { icon: "🧾", title: "Smart Invoicing", desc: "Create professional invoices in seconds and get paid faster." },
  { icon: "📦", title: "Item Catalog", desc: "Build your catalog and auto-fill prices on every invoice." },
  { icon: "📊", title: "Real-time Reports", desc: "Know exactly where your money stands at any moment." },
  { icon: "👥", title: "Customer CRM", desc: "Track every client relationship and their full history." },
  { icon: "💸", title: "Expense Tracking", desc: "Log expenses by category and control your spending." },
  { icon: "📱", title: "Mobile-ready", desc: "Fully responsive — manage your business from anywhere." },
];

function SlideFeatures() {
  return (
    <div className="flex flex-col h-full px-5 pt-14 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-white leading-tight">Everything your<br />business needs</h2>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">One platform to replace spreadsheets, chaos, and guesswork.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {features.map((f) => (
          <div key={f.title} className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-2xl">{f.icon}</span>
            <p className="text-white font-semibold text-sm leading-snug">{f.title}</p>
            <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Link href="/register" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-colors shadow-lg shadow-indigo-600/30">
          Get started free <span className="text-lg">›</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Slide 3: CTA ─────────────────────────────────────────────────────────────
const perks = [
  "No spreadsheets, no chaos",
  "Free to start, no credit card needed",
  "Works for any type of business",
  "Built for African markets",
];

function SlideCTA() {
  return (
    <div className="flex flex-col items-center justify-between h-full px-6 pt-16 pb-6 text-center">
      <div className="flex flex-col items-center gap-4 flex-1 justify-center">
        {/* Rocket icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-4xl shadow-lg shadow-indigo-600/30 mb-2">
          🚀
        </div>

        <h2 className="text-3xl font-extrabold text-white leading-tight">Ready to take<br />control?</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
          Join hundreds of businesses already running smarter with Brandfledger. It&apos;s free to begin — no credit card required.
        </p>

        {/* Perks list */}
        <div className="flex flex-col gap-3 w-full mt-2">
          {perks.map((perk) => (
            <div key={perk} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-slate-700/60 bg-slate-800/40 text-left">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-white text-sm font-medium">{perk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full">
        <Link href="/register" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-colors shadow-lg shadow-indigo-600/30">
          Create my free workspace <span className="text-lg">→</span>
        </Link>
        <Link href="/login" className="flex items-center justify-center w-full py-4 rounded-2xl border border-slate-600 bg-slate-800/50 text-white font-medium text-base hover:bg-slate-700/50 transition-colors">
          Already have an account? Log in
        </Link>
      </div>
    </div>
  );
}

// ─── Main Landing ─────────────────────────────────────────────────────────────
export default function LandingClient() {
  const [current, setCurrent] = useState(0);
  const startX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function goTo(idx: number) {
    if (idx < 0 || idx >= slides.length) return;
    setCurrent(idx);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goTo(current + 1);
      else goTo(current - 1);
    }
    startX.current = null;
  }

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(current + 1);
      if (e.key === "ArrowLeft") goTo(current - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  const slideComponents = [<SlideHero key="hero" />, <SlideFeatures key="features" />, <SlideCTA key="cta" />];

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f1117 0%, #13151f 50%, #0d0f1a 100%)" }}
    >
      {/* Slide container */}
      <div
        ref={containerRef}
        className="h-full overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-400 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)`, width: `${slides.length * 100}%`, transition: "transform 0.38s cubic-bezier(0.4,0,0.2,1)" }}
        >
          {slideComponents.map((slide, i) => (
            <div key={i} className="h-full flex-shrink-0" style={{ width: `${100 / slides.length}%` }}>
              {slide}
            </div>
          ))}
        </div>
      </div>

      {/* Nav bar */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 pb-8 pt-3"
        style={{ background: "linear-gradient(to top, rgba(13,15,26,0.95) 0%, transparent 100%)" }}
      >
        <button
          onClick={() => goTo(current - 1)}
          className={`text-sm font-medium transition-all ${current === 0 ? "opacity-0 pointer-events-none" : "text-slate-400 hover:text-white"}`}
        >
          ← Prev
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-300"
              style={{
                width: i === current ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? "#6366f1" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(current + 1)}
          className={`text-sm font-medium transition-all ${current === slides.length - 1 ? "opacity-0 pointer-events-none" : "text-slate-400 hover:text-white"}`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
