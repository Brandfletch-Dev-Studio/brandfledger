"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Package, Users, MoreHorizontal, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppMenu } from "./app-menu";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/transactions", label: "Log", icon: ArrowLeftRight },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Clients", icon: Users },
];

const moreRoutes = ["/expenses", "/reports", "/settings", "/subscription"];

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
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn("flex items-center justify-center rounded-xl h-7 w-10 sm:h-8 sm:w-12 transition-colors", active && "bg-primary/10")}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-medium",
            isMoreActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <div className={cn("flex items-center justify-center rounded-xl h-7 w-10 sm:h-8 sm:w-12 transition-colors", isMoreActive && "bg-primary/10")}>
            <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          More
        </button>
      </nav>
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
