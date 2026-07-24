"use client";
import { useState, useEffect } from "react";
import { Menu, Bell, LogOut, User, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { AppMenu } from "./app-menu";
import { BusinessSwitcher } from "./business-switcher";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAllCaches } from "@/hooks/use-cached-fetch";
import { getDefaultBusiness } from "@/lib/default-business";

interface TopBarProps {
  businessName?: string | null;
  userEmail?: string | null;
  isAdmin?: boolean;
}

export function TopBar({ businessName, userEmail, isAdmin = false }: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const sb = createClient();
      const { data: biz } = await getDefaultBusiness(sb);
      if (!biz) return;
      const { data } = await sb
        .from("notifications")
        .select("*")
        .eq("business_id", biz.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications(data ?? []);
    } catch {}
  }

  async function markAllRead() {
    const sb = createClient();
    const { data: biz } = await getDefaultBusiness(sb);
    if (!biz) return;
    await sb.from("notifications").update({ read: true }).eq("business_id", biz.id).eq("read", false);
    loadNotifications();
  }

  async function handleSignOut() {
    const sb = createClient();
    await sb.auth.signOut();
    clearAllCaches();
    localStorage.removeItem("activeBusinessId");
    router.push("/auth");
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const notifIcons: Record<string, any> = {
    trial_reminder: Clock,
    trial_expired: AlertCircle,
    payment_success: CheckCircle2,
  };

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
            onClick={() => { setNotifOpen(o => !o); }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-muted relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border bg-card shadow-lg z-40 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
                  ) : (
                    notifications.map((n) => {
                      const Icon = notifIcons[n.type] || Bell;
                      return (
                        <div
                          key={n.id}
                          className={`px-3 py-2.5 border-b hover:bg-muted/30 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                          onClick={() => router.push("/subscription")}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{n.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
