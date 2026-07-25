"use client";
import { useState } from "react";
import { Menu, Bell, LogOut, User, Settings, ChevronRight } from "lucide-react";
import { AppMenu } from "./app-menu";
import { BusinessSwitcher } from "./business-switcher";
import { useRouter } from "next/navigation";
import { clearAllCaches } from "@/hooks/use-cached-fetch";

interface TopBarProps {
  businessName?: string | null;
  userEmail?: string | null;
  isAdmin?: boolean;
}

export function TopBar({ businessName, userEmail, isAdmin = false }: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {}
    clearAllCaches();
    try { localStorage.clear(); } catch {}
    // Hard redirect — bypasses Next.js router cache so cookie absence is detected
    window.location.href = "/auth";
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "??";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center justify-between gap-1 border-b bg-card px-2 sm:px-3">
        {/* Left: hamburger + business switcher */}
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

        {/* Right: account avatar */}
        <div className="relative shrink-0">
          <button
            onClick={() => setAccountOpen(o => !o)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
            aria-label="Account"
          >
            {initials}
          </button>

          {accountOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border bg-card shadow-xl z-40 overflow-hidden">
                {/* Account header */}
                <div className="px-4 py-3 bg-primary/5 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{userEmail?.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-2 space-y-0.5">
                  <button
                    onClick={() => { setAccountOpen(false); router.push("/account"); }}
                    className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Profile & Account</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>

                  <button
                    onClick={() => { setAccountOpen(false); router.push("/settings"); }}
                    className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Business Settings</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => { setAccountOpen(false); router.push("/admin"); }}
                      className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Admin Panel</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Sign out */}
                <div className="border-t p-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
