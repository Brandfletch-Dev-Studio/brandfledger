import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Brandfledger", template: "%s | Brandfledger" },
  description: "The financial operating system for small businesses. Invoices, expenses, payments, and reports — all in one place.",
  keywords: ["invoicing", "accounting", "small business", "expenses", "payments"],
  openGraph: {
    title: "Brandfledger",
    description: "Run your business finances from one clean dashboard.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}