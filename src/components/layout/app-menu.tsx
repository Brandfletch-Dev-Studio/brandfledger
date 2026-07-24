"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, CreditCard, Receipt,
  Package, BarChart3, Settings, Crown, UserCircle2, X,
  ArrowLeftRight, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/invoices", label: "Sales / Invoices", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Clients", icon: Users },
];

const moreNav = [
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: UserCircle2 },
  { href: "/subscription", label: "Pricing", icon: Crown },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppMenuProps {
  open: boolean;
  onClose: () => void;
}

export function AppMenu({ open, onClose }: AppMenuProps) {
  const pathname = usePathname();

  if (!open) return null;

  const Item = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
          active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"
        )}
      >
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", active ? "bg-primary-foreground/15" : "bg-muted")}>
          <Icon className="h-4 w-4" />
        </div>
        {label}
      </Link>
    );
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-8 shadow-lg animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Menu</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {primaryNav.map((item) => <Item key={item.href} {...item} />)}
        </div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3.5 mt-4 mb-1.5">More</p>
        <div className="space-y-1">
          {moreNav.map((item) => <Item key={item.href} {...item} />)}
        </div>
      </div>
    </div>
  );
}
