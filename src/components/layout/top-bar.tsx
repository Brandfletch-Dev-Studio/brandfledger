"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, Bell, ChevronDown, Zap } from "lucide-react";
import { AppMenu } from "./app-menu";

interface TopBarProps {
  businessName?: string | null;
}

export function TopBar({ businessName }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between gap-1 border-b bg-card px-2 sm:px-3">
        <div className="flex items-center gap-0.5 min-w-0">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/settings" className="flex items-center gap-1.5 min-w-0 px-1.5 py-1.5 rounded-lg hover:bg-muted">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-xs sm:text-sm font-semibold truncate max-w-[7rem] sm:max-w-xs">{businessName || "Brandfledger"}</span>
            <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
          </Link>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border bg-card shadow-lg z-40 p-4 text-center">
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            </>
          )}
        </div>
      </header>
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
