"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const sb = createClient();
    try {
      // Query auth_users table
      const { data, error } = await sb
        .from("auth_users")
        .select("id, email, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each user, get their business count
      const enriched = await Promise.all(
        (data ?? []).map(async (u) => {
          const { count } = await sb
            .from("businesses")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", u.id);
          return { ...u, bizCount: count ?? 0 };
        })
      );

      setUsers(enriched);
    } catch {
      // auth_users might not exist or not be accessible
      try {
        const { data, error } = await sb
          .from("businesses")
          .select("owner_id, email, created_at, name")
          .order("created_at", { ascending: false });
        if (!error && data) {
          // Deduplicate by owner_id
          const seen = new Set();
          const deduped = data.filter((b: any) => {
            if (seen.has(b.owner_id)) return false;
            seen.add(b.owner_id);
            return true;
          });
          setUsers(deduped.map((b: any) => ({
            id: b.owner_id,
            email: b.email || "No email",
            created_at: b.created_at,
            bizCount: data.filter((d: any) => d.owner_id === b.owner_id).length,
          })));
        }
      } catch {}
    }
    setLoading(false);
  }

  const filtered = users.filter(
    (u) => u.email?.toLowerCase().includes(search.toLowerCase())
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
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">All registered users on the platform.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-semibold text-sm text-primary">
                      {(u.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {u.bizCount} business{u.bizCount !== 1 ? "es" : ""}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
