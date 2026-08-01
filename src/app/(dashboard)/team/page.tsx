"use client";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Trash2, Shield, Crown, User, Eye, MessageCircle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  whatsapp_number: string | null;
  is_owner: boolean;
  created_at: string;
}

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600", desc: "Full access. Can manage team, settings, and all financial operations." },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600", desc: "Full financial access. Cannot manage team or change business settings." },
  member: { label: "Member", icon: User, color: "text-emerald-600", desc: "Can record transactions, create invoices, and view all financial data." },
  viewer: { label: "Viewer", icon: Eye, color: "text-muted-foreground", desc: "Read-only access. Can view financial data but cannot make changes." },
};

export default function TeamPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      toast({ title: "Failed to load team", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const addMember = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/data/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Team member added", description: `${data.member.name} added as ${roleConfig[newRole as keyof typeof roleConfig].label}` });
        setNewEmail("");
        setShowAddForm(false);
        load();
      } else {
        toast({ title: "Could not add member", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const updateRole = async (memberId: string, role: string) => {
    setUpdatingId(memberId);
    try {
      const res = await fetch("/api/data/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, role }),
      });
      if (res.ok) {
        toast({ title: "Role updated" });
        load();
      } else {
        const data = await res.json();
        toast({ title: "Update failed", description: data.error, variant: "destructive" });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) return;
    try {
      const res = await fetch(`/api/data/team?member_id=${memberId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Team member removed", description: `${name} no longer has access` });
        load();
      } else {
        const data = await res.json();
        toast({ title: "Removal failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <Header title="Team" />

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Role legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles & Permissions</CardTitle>
            <CardDescription>Control what each team member can do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(roleConfig).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-start gap-3">
                  <Icon className={`h-4 w-4 mt-0.5 ${cfg.color}`} />
                  <div>
                    <p className="text-sm font-medium">{cfg.label}</p>
                    <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Add member button / form */}
        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} className="w-full" variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Team Member</CardTitle>
              <CardDescription>They must have a Brandfledger account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Full financial access</SelectItem>
                    <SelectItem value="member">Member — Record & view</SelectItem>
                    <SelectItem value="viewer">Viewer — Read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={addMember} disabled={adding || !newEmail.trim()} className="flex-1">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Member"}
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="outline">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team member list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No team members yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const cfg = roleConfig[member.role as keyof typeof roleConfig] || roleConfig.member;
              const Icon = cfg.icon;
              return (
                <Card key={member.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          member.name?.charAt(0)?.toUpperCase() || "?"
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <Icon className={`h-3.5 w-3.5 ${cfg.color} flex-shrink-0`} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {member.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {member.email}
                            </span>
                          )}
                          {member.whatsapp_number && (
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {member.whatsapp_number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {member.is_owner ? (
                          <span className="text-xs font-medium text-amber-600">Owner</span>
                        ) : (
                          <>
                            <Select
                              value={member.role}
                              onValueChange={(v) => updateRole(member.id, v)}
                              disabled={updatingId === member.id}
                            >
                              <SelectTrigger className="h-8 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeMember(member.id, member.name)}
                              className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* WhatsApp info */}
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Team members can link their WhatsApp number in <span className="font-medium">Settings</span> to use the Finance Manager.
                Each number is linked to one business. {roleConfig.viewer.label}s can view data but cannot record transactions via WhatsApp.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
