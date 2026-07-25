"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, DollarSign, Users, Building2, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/pricing", label: "Pricing", icon: DollarSign },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-full">
      {/* Admin header */}
      <div className="border-b bg-card px-3 sm:px-6 py-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Admin Panel</span>
      </div>

      {/* Horizontal scrollable tab nav — no pointer-events clipping */}
      <div className="border-b bg-card">
        <div className="flex gap-1 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-none">
          {adminNav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-6">
        {children}
      </div>
    </div>
  );
}
