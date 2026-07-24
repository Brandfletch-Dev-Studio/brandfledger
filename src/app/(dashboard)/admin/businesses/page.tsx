"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default function AdminBusinessesPage() {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    setLoading(true);
    const sb = createClient();
    try {
      const { data, error } = await sb
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each business, get transaction count and revenue
      const enriched = await Promise.all(
        (data ?? []).map(async (biz) => {
          const { count, data: txData } = await sb
            .from("transactions")
            .select("amount, type")
            .eq("business_id", biz.id);

          const revenue = (txData ?? [])
            .filter((t: any) => t.type === "income")
            .reduce((s: number, t: any) => s + Number(t.amount), 0);

          return { ...biz, txCount: count ?? 0, revenue };
        })
      );

      setBusinesses(enriched);
    } catch {}
    setLoading(false);
  }

  const filtered = businesses.filter(
    (b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Businesses</h2>
        <p className="text-sm text-muted-foreground">All businesses registered on the platform.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search businesses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Building2 className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No businesses found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((biz) => (
            <Card key={biz.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{biz.name}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{biz.email || "No email"}</span>
                      <span>·</span>
                      <span>{biz.business_type || "Unknown type"}</span>
                      <span>·</span>
                      <span>Joined {formatDate(biz.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatCurrency(biz.revenue, biz.currency || "MWK")}</p>
                  <p className="text-xs text-muted-foreground">{biz.txCount} transactions</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
