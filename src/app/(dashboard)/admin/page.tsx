"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Users, Building2, TrendingUp, TrendingDown,
  Crown, Clock, AlertCircle, RefreshCw, Send, CalendarClock,
  UserX, BadgeCheck, Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function StatCard({
  label, value, sub, icon: Icon, color = "text-primary", trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 shrink-0 ${color}`} />
          <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
        </div>
        <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    trial:   "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    expired: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 capitalize shrink-0 ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

export default function AdminOverviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [pendingRenewals, setPendingRenewals] = useState<any[]>([]);
  const [expiredAccounts, setExpiredAccounts] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=overview");
      const data = await res.json();
      setStats(data.stats);
      setPendingRenewals(data.pendingRenewals ?? []);
      setExpiredAccounts(data.expiredAccounts ?? []);
    } catch { toast({ title: "Failed to load", variant: "destructive" }); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function sendReminder(u: any) {
    setReminderLoading(u.user_id);
    try {
      const res = await fetch("/api/data/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reminder", user_id: u.user_id, email: u.email, name: u.name }),
      });
      if (res.ok) toast({ title: "Reminder sent", description: u.email });
      else toast({ title: "Failed to send", description: "Check Resend config", variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setReminderLoading(null);
  }

  async function extendTrial(u: any, days: number) {
    setExtendLoading(u.user_id);
    try {
      const res = await fetch("/api/data/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend_trial", user_id: u.user_id, days }),
      });
      if (res.ok) { toast({ title: `Trial extended +${days} days`, description: u.email }); load(); }
      else toast({ title: "Failed", variant: "destructive" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setExtendLoading(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const churnRate = stats?.totalAccounts > 0
    ? ((stats.churnLast30Days / stats.totalAccounts) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Platform Overview</h2>
          <p className="text-xs text-muted-foreground">Live metrics for Brandfledger SaaS</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Primary KPIs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Users</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatCard label="Total Accounts"    value={stats?.totalAccounts ?? 0}      icon={Users}       color="text-foreground" />
          <StatCard label="Active Subscribers" value={stats?.activeSubscribers ?? 0}  icon={BadgeCheck}  color="text-emerald-600"
            sub={`of ${stats?.totalAccounts ?? 0} accounts`} />
          <StatCard label="On Free Trial"     value={stats?.trialUsers ?? 0}          icon={Clock}       color="text-amber-600" />
          <StatCard label="Expired / Churned" value={stats?.expiredUsers ?? 0}        icon={UserX}       color="text-rose-600" />
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revenue</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatCard label="Platform Revenue"   value={formatCurrency(stats?.totalRevenue ?? 0, "MWK")}    icon={Crown}        color="text-primary"
            sub={`${stats?.totalPayments ?? 0} payments`} />
          <StatCard label="Monthly Subs"       value={formatCurrency(stats?.monthlyRevenue ?? 0, "MWK")}  icon={TrendingUp}   color="text-indigo-600" />
          <StatCard label="New This Month"     value={stats?.newThisMonth ?? 0}                            icon={Sparkles}     color="text-sky-600"
            sub="new signups (30 days)" />
          <StatCard label="Churn (30 days)"    value={`${churnRate}%`}                                    icon={TrendingDown} color="text-rose-500"
            sub={`${stats?.churnLast30Days ?? 0} accounts expired`} />
        </div>
      </div>

      {/* Pending Renewals */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Renewals <span className="text-amber-600 ml-1">({pendingRenewals.length})</span>
          </p>
        </div>
        {pendingRenewals.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">No renewals due in the next 7 days</CardContent></Card>
        ) : (
          <Card>
            <div className="divide-y">
              {pendingRenewals.map((u: any) => (
                <div key={u.user_id} className="flex items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">
                      {Math.ceil(Number(u.days_left))}d left
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Expired Accounts — Manual Reminders */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-rose-500" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Expired — Manual Outreach <span className="text-rose-500 ml-1">({expiredAccounts.length})</span>
          </p>
        </div>
        {expiredAccounts.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">No recently expired accounts</CardContent></Card>
        ) : (
          <Card>
            <div className="divide-y">
              {expiredAccounts.map((u: any) => (
                <div key={u.user_id} className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                        <StatusBadge status="expired" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      {u.business_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />{u.business_name}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs flex-1 gap-1"
                      disabled={reminderLoading === u.user_id}
                      onClick={() => sendReminder(u)}
                    >
                      {reminderLoading === u.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Send className="h-3 w-3" />}
                      Send Reminder
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs flex-1 gap-1 text-sky-600 border-sky-200 hover:bg-sky-50"
                      disabled={extendLoading === u.user_id}
                      onClick={() => extendTrial(u, 7)}
                    >
                      {extendLoading === u.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Clock className="h-3 w-3" />}
                      +7 Day Trial
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
