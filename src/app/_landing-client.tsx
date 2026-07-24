"use client";
import Link from "next/link";
import {
  TrendingUp,
  FileText,
  BarChart3,
  ArrowRight,
  Zap,
} from "lucide-react";

export default function LandingClient() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ── TOP NAV BAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo on Left */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-bold text-base sm:text-lg text-gray-900 tracking-tight">Brandfledger</span>
          </div>

          {/* Links — hidden on mobile, shown on desktop */}
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </a>
          </nav>

          {/* Get Started Button on Right */}
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── CENTERED HERO SECTION ── */}
      <main className="flex-1 flex flex-col">
        <section className="max-w-5xl mx-auto px-4 sm:px-5 pt-12 sm:pt-20 pb-8 sm:pb-12 text-center flex flex-col items-center">
          {/* Pill Badge at top */}
          <div
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-600 mb-5 sm:mb-6 shadow-sm"
            style={{ backgroundColor: "#eef2ff" }}
          >
            <span>📊 Accounting made simple</span>
          </div>

          {/* Large Headline (two lines) */}
          <h1 className="text-3xl sm:text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.15] sm:leading-[1.1] tracking-tight mb-4 sm:mb-5">
            Know your numbers.<br />
            Grow your business.
          </h1>

          {/* Subtext */}
          <p className="text-sm sm:text-lg text-gray-500 max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
            Track every sale, every expense, every profit margin — all in one place.
          </p>

          {/* Centered CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors text-base"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white text-gray-700 font-semibold shadow-sm transition-colors text-base"
            >
              Watch Demo
            </button>
          </div>
        </section>

        {/* ── FEATURES SECTION ── */}
        <section id="features" className="max-w-5xl mx-auto px-4 sm:px-5 pt-6 sm:pt-8 pb-16 sm:pb-20 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {/* Profit Tracking */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Profit Tracking</h3>
              <p className="text-sm text-gray-500">Per sale margins</p>
            </div>

            {/* Invoicing */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Invoicing</h3>
              <p className="text-sm text-gray-500">Send & track</p>
            </div>

            {/* Reports */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Reports</h3>
              <p className="text-sm text-gray-500">Visual insights</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 bg-white py-4 sm:py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">Brandfledger</span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Brandfledger. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
