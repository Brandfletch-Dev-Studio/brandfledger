"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
    b.name?.toLowerCase().includes(search.toLowerCase())
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
        <Input placeholder="Search businesses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
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
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{biz.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{biz.currency || "MWK"}</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px]">{biz.subscription_status || "trial"}</Badge>
                      <span>·</span>
                      <span>Joined {formatDate(biz.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{biz.tx_count || 0} transactions</p>
                  <p className="text-xs text-muted-foreground">{biz.cust_count || 0} clients · {biz.prod_count || 0} products</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
