import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a currency amount. For large amounts (≥10,000) uses compact notation:
 * 1,200 → "MWK 1.2K", 2,870,600 → "MWK 2.9M"
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  const abs = Math.abs(amount ?? 0);
  const sign = (amount ?? 0) < 0 ? "-" : "";
  const prefix = getCurrencyPrefix(currency);

  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(1)}K`;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount ?? 0);
  } catch {
    return `${sign}${prefix}${abs.toFixed(0)}`;
  }
}

function getCurrencyPrefix(currency: string): string {
  const map: Record<string, string> = {
    MWK: "MWK ",
    USD: "$",
    EUR: "€",
    GBP: "£",
    ZAR: "R",
    NGN: "₦",
    KES: "KSh ",
    GHS: "GH₵",
    CAD: "CA$",
    AUD: "A$",
  };
  return map[currency] ?? `${currency} `;
}

/**
 * Full precision currency (for detail views / invoices)
 */
export function formatCurrencyFull(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
  } catch {
    return String(date);
  }
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return String(amount);
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function calculateInvoiceTotals(
  items: { quantity: number; unit_price: number }[],
  taxRate = 0
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function daysUntil(date: string): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
