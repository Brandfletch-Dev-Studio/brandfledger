"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Building2, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    businesses: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    totalClients: 0,
  });
  const [businesses, setBusinesses] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/admin?section=overview");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStats({
        businesses: data.stats?.businesses ?? 0,
        totalRevenue: data.stats?.totalRevenue ?? 0,
        totalTransactions: data.stats?.totalTransactions ?? 0,
        totalClients: data.stats?.totalClients ?? 0,
      });
      setBusinesses(data.businesses || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const cards = [
    { label: "Businesses", value: stats.businesses, icon: Building2, currency: false },
    { label: "Total Revenue", value: stats.totalRevenue, icon: DollarSign, currency: true },
    { label: "Transactions", value: stats.totalTransactions, icon: TrendingUp, currency: false },
    { label: "Clients", value: stats.totalClients, icon: Users, currency: false },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">High-level metrics across all businesses on the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-xl font-bold">
                {card.currency ? formatCurrency(card.value, "MWK") : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {businesses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Recent Businesses</h3>
          <Card>
            <div className="divide-y">
              {businesses.slice(0, 10).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.currency} · {b.subscription_status}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
