// NEW FILE: src/app/(dashboard)/team/page.tsx
// Full team members management page — invite members, manage roles, remove members

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Trash2, Loader2, Crown, Shield, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Business, BusinessMember, UserRole } from "@/types";

const roleIcons: Record<UserRole, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <Users className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
};

const roleColors: Record<UserRole, string> = {
  owner: "bg-yellow-100 text-yellow-800",
  admin: "bg-blue-100 text-blue-800",
  member: "bg-green-100 text-green-700",
  viewer: "bg-muted text-muted-foreground",
};

const roleDescriptions: Record<UserRole, string> = {
  owner: "Full access, billing, can delete business",
  admin: "Full access except billing",
  member: "Can create and edit records",
  viewer: "Read-only access",
};

interface MemberWithProfile extends BusinessMember {
  profiles?: { full_name: string | null; email: string | null };
}

export default function TeamPage() {
  const { toast } = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: biz } = await supabase.from("businesses").select("*").eq("owner_id", user.id).single();
    setBusiness(biz);
    if (!biz) return;

    const { data: mems } = await supabase
      .from("business_members")
      .select("*")
      .eq("business_id", biz.id)
      .order("created_at");

    setMembers(mems ?? []);
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !business) return;
    setLoading(true);
    try {
      const supabase = createClient();

      // Look up user by email via a custom RPC or just insert with a pending state
      // For now we insert directly — in production you'd send an invite email
      // and let the user accept it, linking their user_id.
      // We create a pending invite record. The user_id can be set on acceptance.
      // For demo: try to find the user, otherwise show a message.
      const { data: profileData } = await supabase
        .from("profiles")  // assumes a profiles table exists (standard Supabase pattern)
        .select("id")
        .eq("email", inviteEmail.trim().toLowerCase())
        .single();

      if (!profileData) {
        toast({
          title: "User not found",
          description: `No account found for ${inviteEmail}. They must sign up first.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("business_members").insert({
        business_id: business.id,
        user_id: profileData.id,
        role: inviteRole,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already a member", description: "This user is already on your team.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Member added!", description: `${inviteEmail} added as ${inviteRole}.` });
        setOpen(false);
        setInviteEmail("");
        loadData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(memberId: string, newRole: UserRole) {
    const supabase = createClient();
    const { error } = await supabase.from("business_members").update({ role: newRole }).eq("id", memberId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Role updated" });
    loadData();
  }

  async function removeMember(memberId: string, userId: string) {
    if (userId === currentUserId) { toast({ title: "Can't remove yourself", variant: "destructive" }); return; }
    if (!confirm("Remove this member from your team?")) return;
    const supabase = createClient();
    await supabase.from("business_members").delete().eq("id", memberId);
    toast({ title: "Member removed" });
    loadData();
  }

  return (
    <div>
      <Header title="Team" description="Manage who has access to your business" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
          <Button onClick={() => setOpen(true)}><UserPlus className="mr-2 h-4 w-4" /> Add Member</Button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No team members yet. It's just you!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {m.profiles?.full_name?.[0]?.toUpperCase() ?? m.profiles?.email?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}</div>
                        {m.profiles?.full_name && <div className="text-xs text-muted-foreground truncate">{m.profiles.email}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.role === "owner" || m.user_id === business?.owner_id ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors["owner"]}`}>
                          {roleIcons["owner"]} owner
                        </span>
                      ) : (
                        <Select value={m.role} onValueChange={v => updateRole(m.id, v as UserRole)} disabled={m.user_id === currentUserId}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["admin", "member", "viewer"] as UserRole[]).map(r => (
                              <SelectItem key={r} value={r}>
                                <span className="flex items-center gap-1.5">{roleIcons[r]} {r}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {m.role !== "owner" && m.user_id !== business?.owner_id && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeMember(m.id, m.user_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Role legend */}
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Role permissions</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(roleDescriptions) as [UserRole, string][]).map(([role, desc]) => (
              <div key={role} className="flex items-start gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${roleColors[role]}`}>
                  {roleIcons[role]} {role}
                </span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">They must already have a Brandfledger account.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["admin", "member", "viewer"] as UserRole[]).map(r => (
                    <SelectItem key={r} value={r}>
                      <div>
                        <div className="flex items-center gap-1.5">{roleIcons[r]} {r.charAt(0).toUpperCase() + r.slice(1)}</div>
                        <div className="text-xs text-muted-foreground">{roleDescriptions[r]}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={loading || !inviteEmail.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
