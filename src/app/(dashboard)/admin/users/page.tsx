"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
    u.email?.toLowerCase().includes(search.toLowerCase()) || u.business_name?.toLowerCase().includes(search.toLowerCase())
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
        <Input placeholder="Search by email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u: any, i: number) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-semibold text-sm text-primary">
                      {(u.business_name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.business_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">{u.subscription_status || "trial"}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
