"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users, Crown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TeamPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setPageLoading(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setPageLoading(false); return; }
    const { data: biz, error: bizError } = await sb.from("businesses").select("id").eq("owner_id", user.id).single();
    if (bizError && bizError.code !== "PGRST116") {
      toast({ title: "Couldn't load business", description: bizError.message, variant: "destructive" });
      setPageLoading(false); return;
    }
    if (!biz) { setPageLoading(false); return; }
    const { data, error } = await sb.from("business_members").select("*").eq("business_id", biz.id);
    if (error) toast({ title: "Couldn't load team members", description: error.message, variant: "destructive" });
    setMembers(data ?? []);
    setPageLoading(false);
  }

  return (
    <div>
      <Header title="Team" description="Manage team members and permissions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="mr-2 h-4 w-4" />Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Team invitations are available on the Starter plan and above.</p>
                <div className="space-y-2"><Label>Email address</Label><Input type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin — full access</SelectItem>
                      <SelectItem value="member">Member — view and edit</SelectItem>
                      <SelectItem value="viewer">Viewer — read only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => { toast({ title: "Upgrade required", description: "Invite team members on the Starter plan." }); setOpen(false); }}>Send invite</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6 space-y-4">
        {pageLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Team members</CardTitle>
                <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No team members yet. Invite someone to collaborate.</p>
                ) : (
                  <div className="space-y-3">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {m.role === "owner" ? <Crown className="h-4 w-4" /> : m.user_id.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.user_id.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{m.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Upgrade to Starter</strong> to invite team members and set custom role permissions.
            </div>
          </>
        )}
      </div>
    </div>
  );
}