"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Search, Mail, Clock } from "lucide-react";
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

export default function AdminBusinessesPage() {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=businesses");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

  const filtered = businesses.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Businesses</h2>
        <p className="text-sm text-muted-foreground">All businesses registered on the platform.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search businesses or owners..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Building2 className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No businesses found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((biz: any) => (
            <Card key={biz.id}>
              <CardContent className="p-4">
                {/* Top row: icon + name + status */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="font-semibold text-sm text-primary">
                        {(biz.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{biz.name}</p>
                      {biz.owner_email && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />{biz.owner_email}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={biz.subscription_status} />
                </div>

                {/* Details */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pl-[52px]">
                  <span>{biz.currency || "MWK"}</span>
                  {biz.plan && <span className="capitalize">{biz.plan} plan</span>}
                  <span>Joined {formatDate(biz.created_at)}</span>
                </div>

                {/* Subscription duration */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pl-[52px] mt-1">
                  {biz.subscription_status === "active" && biz.sub_duration_days !== null && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Clock className="h-3 w-3 shrink-0" />
                      Subscribed for {formatDuration(biz.sub_duration_days)}
                    </span>
                  )}
                  {biz.subscription_status === "trial" && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3 shrink-0" />
                      {biz.days_left !== null && biz.days_left > 0
                        ? `${biz.days_left} day${biz.days_left > 1 ? "s" : ""} left`
                        : "Trial expired"}
                    </span>
                  )}
                  {biz.subscription_status === "active" && biz.days_left !== null && (
                    <span className="text-muted-foreground">
                      Renews in {biz.days_left} day{biz.days_left > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Usage stats */}
                <div className="flex gap-4 text-xs text-muted-foreground pl-[52px] mt-1.5 pt-1.5 border-t">
                  <span>{biz.tx_count || 0} transactions</span>
                  <span>{biz.cust_count || 0} clients</span>
                  <span>{biz.prod_count || 0} products</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
