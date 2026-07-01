"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, FileText, Package, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppMenu } from "./app-menu";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/invoices", label: "Sales", icon: FileText },
  { href: "/products", label: "Items", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
];

const moreRoutes = ["/payments", "/expenses", "/reports", "/team", "/subscription", "/settings"];

export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMoreActive = moreRoutes.some(r => pathname.startsWith(r));

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
            >
              <div className={cn("flex items-center justify-center rounded-xl h-8 w-12 transition-colors", active && "bg-primary/10")}>
                <Icon className="h-5 w-5" />
              </div>
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", isMoreActive ? "text-primary" : "text-muted-foreground")}
        >
          <div className={cn("flex items-center justify-center rounded-xl h-8 w-12 transition-colors", isMoreActive && "bg-primary/10")}>
            <MoreHorizontal className="h-5 w-5" />
          </div>
          More
        </button>
      </nav>
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
