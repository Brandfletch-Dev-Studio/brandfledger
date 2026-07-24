"use client";
import { useState } from "react";
import { Menu, Bell } from "lucide-react";
import { AppMenu } from "./app-menu";
import { BusinessSwitcher } from "./business-switcher";

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
          <BusinessSwitcher currentName={businessName} />
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
