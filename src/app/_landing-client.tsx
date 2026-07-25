"use client";
import Link from "next/link";
import {
  TrendingUp,
  FileText,
  BarChart3,
  ArrowRight,
  Mail,
  Twitter,
  Globe,
} from "lucide-react";

export default function LandingClient() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* ── TOP NAV BAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <img
              src="/logo.png"
              alt="Brandfledger"
              className="w-8 h-8 rounded-xl shadow-sm"
            />
            <span className="font-bold text-base sm:text-lg text-gray-900 tracking-tight">Brandfledger</span>
          </div>

          {/* Nav links — desktop only */}
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">Pricing</a>
          </nav>

          <Link
            href="/auth"
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="flex-1 flex flex-col">
        <section className="max-w-5xl mx-auto px-4 sm:px-5 pt-12 sm:pt-20 pb-8 sm:pb-12 text-center flex flex-col items-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-600 mb-5 sm:mb-6 shadow-sm"
            style={{ backgroundColor: "#eef2ff" }}
          >
            <span>📊 Accounting made simple</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-[1.15] sm:leading-[1.1] tracking-tight mb-4 sm:mb-5">
            Know your numbers.<br />
            Grow your business.
          </h1>

          <p className="text-sm sm:text-lg text-gray-500 max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
            Track every sale, every expense, every profit margin — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link
              href="/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition-colors text-base"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white text-gray-700 font-semibold shadow-sm transition-colors text-base"
            >
              See Features
            </a>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="max-w-5xl mx-auto px-4 sm:px-5 pt-6 sm:pt-8 pb-16 sm:pb-20 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Profit Tracking</h3>
              <p className="text-sm text-gray-500">Per sale margins, real time</p>
            </div>
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Invoicing</h3>
              <p className="text-sm text-gray-500">Send, track & share</p>
            </div>
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Reports</h3>
              <p className="text-sm text-gray-500">Visual business insights</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
            {/* Brand */}
            <div className="flex flex-col gap-3 max-w-xs">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Brandfledger" className="w-9 h-9 rounded-xl shadow-sm" />
                <span className="font-bold text-lg text-gray-900 tracking-tight">Brandfledger</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                The financial operating system for small businesses in Malawi and beyond.
              </p>
              {/* Social */}
              <div className="flex items-center gap-3 mt-1">
                <a
                  href="mailto:hello@brandfledger.com"
                  className="h-8 w-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm"
                  title="Email"
                >
                  <Mail className="w-4 h-4" />
                </a>
                <a
                  href="https://brandfledger-three.vercel.app"
                  target="_blank"
                  className="h-8 w-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm"
                  title="Website"
                >
                  <Globe className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Links grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-semibold text-gray-900 mb-3">Product</p>
                <ul className="space-y-2 text-gray-500">
                  <li><a href="#features" className="hover:text-indigo-600 transition-colors">Features</a></li>
                  <li><a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a></li>
                  <li><Link href="/auth" className="hover:text-indigo-600 transition-colors">Sign Up</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-3">Platform</p>
                <ul className="space-y-2 text-gray-500">
                  <li><Link href="/auth" className="hover:text-indigo-600 transition-colors">Dashboard</Link></li>
                  <li><Link href="/auth" className="hover:text-indigo-600 transition-colors">Invoices</Link></li>
                  <li><Link href="/auth" className="hover:text-indigo-600 transition-colors">Reports</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-3">Support</p>
                <ul className="space-y-2 text-gray-500">
                  <li><a href="mailto:hello@brandfledger.com" className="hover:text-indigo-600 transition-colors">Contact</a></li>
                  <li><span className="text-gray-400">Privacy Policy</span></li>
                  <li><span className="text-gray-400">Terms of Use</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Divider + bottom */}
          <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <p>© {new Date().getFullYear()} Brandfledger. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Built for small businesses <span className="text-red-400">♥</span> in Malawi
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
