"use client";
import { useState } from "react";
import { Menu, Bell, LogOut, User } from "lucide-react";
import { AppMenu } from "./app-menu";
import { BusinessSwitcher } from "./business-switcher";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAllCaches } from "@/hooks/use-cached-fetch";

interface TopBarProps {
  businessName?: string | null;
  userEmail?: string | null;
}

export function TopBar({ businessName, userEmail }: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  async function handleSignOut() {
    const sb = createClient();
    await sb.auth.signOut();
    clearAllCaches();
    localStorage.removeItem("activeBusinessId");
    router.push("/auth");
  }

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

        <div className="flex items-center gap-0.5 shrink-0">
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

          {/* Account dropdown */}
          <div className="relative">
            <button
              onClick={() => setAccountOpen(o => !o)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-muted"
              aria-label="Account"
            >
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border bg-card shadow-lg z-40 p-2">
                  {userEmail && (
                    <div className="px-3 py-2 border-b mb-1">
                      <p className="text-xs font-medium truncate">{userEmail}</p>
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted transition-colors text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
