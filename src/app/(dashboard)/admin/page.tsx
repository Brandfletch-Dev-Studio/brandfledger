"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, Building2, DollarSign, TrendingUp, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    businesses: 0,
    users: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    totalProducts: 0,
    totalClients: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    const sb = createClient();
    try {
      const [bizRes, userRes, txRes, prodRes, custRes] = await Promise.all([
        sb.from("businesses").select("id, currency", { count: "exact", head: false }),
        sb.from("auth_users").select("id", { count: "exact", head: true }),
        sb.from("transactions").select("amount, type"),
        sb.from("products").select("id", { count: "exact", head: true }),
        sb.from("customers").select("id", { count: "exact", head: true }),
      ]);

      const totalRevenue = (txRes.data ?? [])
        .filter((t: any) => t.type === "income")
        .reduce((s: number, t: any) => s + Number(t.amount), 0);

      setStats({
        businesses: bizRes.data?.length ?? 0,
        users: userRes.count ?? 0,
        totalRevenue,
        totalTransactions: txRes.data?.length ?? 0,
        totalProducts: prodRes.count ?? 0,
        totalClients: custRes.count ?? 0,
      });
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { label: "Businesses", value: stats.businesses, icon: Building2, color: "text-primary" },
    { label: "Users", value: stats.users, icon: Users, color: "text-primary" },
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue, "MWK"), icon: DollarSign, color: "text-emerald-600" },
    { label: "Transactions", value: stats.totalTransactions, icon: TrendingUp, color: "text-primary" },
    { label: "Products", value: stats.totalProducts, icon: ShoppingCart, color: "text-primary" },
    { label: "Clients", value: stats.totalClients, icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">High-level metrics across all businesses on the platform.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
