"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings, BarChart3, Receipt, Crown, X, ArrowLeftRight, Shield, FileText, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/subscription", label: "Pricing", icon: Crown },
  { href: "/data", label: "Data Management", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export function AppMenu({ open, onClose, isAdmin = false }: AppMenuProps) {
  const pathname = usePathname();

  if (!open) return null;

  const allItems = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin Panel", icon: Shield }]
    : navItems;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-8 shadow-lg animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="Brandfledger" className="h-8 w-8 rounded-xl" />
            <span className="text-sm font-bold text-foreground">Brandfledger</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allItems.map((item) => {
            const active = item.href === "/admin"
              ? pathname.startsWith("/admin")
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
