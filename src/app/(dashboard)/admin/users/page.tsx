"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Search, Mail, Building2, Calendar, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    trial:   "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    expired: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 capitalize shrink-0 ${map[status] ?? ""}`}>
      {status || "trial"}
    </Badge>
  );
}

function formatDuration(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} day${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months < 12) return `${months}mo${remainingDays > 0 ? ` ${remainingDays}d` : ""}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}yr${remainingMonths > 0 ? ` ${remainingMonths}mo` : ""}`;
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=users");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u: any) =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">All registered users on the platform.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, email, or business..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u: any, i: number) => {
            const displayName = u.name || u.email?.split("@")[0] || "Unknown";
            const initials = displayName.charAt(0).toUpperCase();
            return (
              <Card key={i}>
                <CardContent className="p-4">
                  {/* Top row: avatar + name + status */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-semibold text-sm text-primary">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{displayName}</p>
                        {u.email && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0" />{u.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={u.subscription_status} />
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-[52px]">
                    {u.business_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" />{u.business_name}
                      </span>
                    )}
                    {u.created_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />Joined {formatDate(u.created_at)}
                      </span>
                    )}
                    {u.plan && (
                      <span className="capitalize">{u.plan} plan</span>
                    )}
                  </div>

                  {/* Subscription duration */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pl-[52px] mt-1">
                    {u.subscription_status === "active" && u.sub_duration_days !== null && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Clock className="h-3 w-3 shrink-0" />
                        Subscribed for {formatDuration(u.sub_duration_days)}
                      </span>
                    )}
                    {u.subscription_status === "trial" && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-3 w-3 shrink-0" />
                        {u.days_left !== null && u.days_left > 0
                          ? `${u.days_left} day${u.days_left > 1 ? "s" : ""} left`
                          : "Trial expired"}
                      </span>
                    )}
                    {u.subscription_status === "active" && u.days_left !== null && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        Renews in {u.days_left} day{u.days_left > 1 ? "s" : ""}
                      </span>
                    )}
                    {u.subscription_status === "expired" && u.created_at && (
                      <span className="flex items-center gap-1 text-rose-500">
                        <Clock className="h-3 w-3 shrink-0" />
                        Was subscribed for {formatDuration(u.sub_duration_days)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
