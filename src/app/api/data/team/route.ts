import { NextResponse } from "next/server";
import { supabase, getDbUser, getDefaultBusinessId } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — list all team members for the active business
export async function GET() {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getDefaultBusinessId(user.userId);
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    const { data: members, error } = await supabase
      .from("business_members")
      .select("id, user_id, role, whatsapp_number, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!members || members.length === 0) {
      return NextResponse.json({ members: [], count: 0 });
    }

    // Enrich with profile data
    const userIds = members.map((m) => m.user_id).filter(Boolean);
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, subscription_status")
        .in("id", userIds);
      profiles?.forEach((p) => { profileMap[p.id] = p; });
    }

    const enriched = members.map((m) => {
      const profile = profileMap[m.user_id];
      return {
        id: m.id,
        user_id: m.user_id,
        name: profile?.full_name || profile?.email?.split("@")[0] || "Unknown",
        email: profile?.email || "",
        avatar_url: profile?.avatar_url || null,
        role: m.role,
        whatsapp_number: m.whatsapp_number || null,
        is_owner: m.user_id === user.userId && m.role === "owner",
        created_at: m.created_at,
      };
    });

    return NextResponse.json({ members: enriched, count: enriched.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — add a team member by email
export async function POST(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email, role } = await request.json();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!role || !["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be admin, member, or viewer." }, { status: 400 });
    }

    const business = await getDefaultBusinessId(user.userId);
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    // Verify caller is owner
    const { data: callerMember } = await supabase
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (callerMember?.role !== "owner") {
      return NextResponse.json({ error: "Only the business owner can add team members" }, { status: 403 });
    }

    // Find user by email in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        error: `No Brandfledger account found for ${email}. Ask them to sign up at brandfledger.com first, then add them as a team member.`,
      }, { status: 404 });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("business_members")
      .select("id, role")
      .eq("business_id", business.id)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "This person is already a team member" }, { status: 409 });
    }

    // Add as team member
    const { data: newMember, error } = await supabase
      .from("business_members")
      .insert({
        business_id: business.id,
        user_id: profile.id,
        role,
      })
      .select("id, role, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      member: {
        id: newMember.id,
        user_id: profile.id,
        name: profile.full_name || profile.email?.split("@")[0],
        email: profile.email,
        role: newMember.role,
        whatsapp_number: null,
        created_at: newMember.created_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update a team member's role or WhatsApp number
export async function PATCH(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { member_id, role, whatsapp_number } = await request.json();
    if (!member_id) return NextResponse.json({ error: "Member ID is required" }, { status: 400 });

    const business = await getDefaultBusinessId(user.userId);
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    // Verify caller is owner
    const { data: callerMember } = await supabase
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (callerMember?.role !== "owner") {
      return NextResponse.json({ error: "Only the business owner can modify team members" }, { status: 403 });
    }

    // Prevent changing the owner's role
    const { data: targetMember } = await supabase
      .from("business_members")
      .select("role, user_id")
      .eq("id", member_id)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot modify the owner's role" }, { status: 403 });
    }

    const updates: any = {};
    if (role && ["admin", "member", "viewer"].includes(role)) {
      updates.role = role;
    }
    if (whatsapp_number !== undefined) {
      // Validate and check uniqueness
      if (whatsapp_number && !/^\d{8,15}$/.test(whatsapp_number)) {
        return NextResponse.json({ error: "Invalid WhatsApp number format" }, { status: 400 });
      }
      if (whatsapp_number) {
        const { data: existingLink } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("whatsapp_number", whatsapp_number)
          .neq("id", member_id)
          .limit(1);
        if (existingLink && existingLink.length > 0) {
          return NextResponse.json({ error: "This WhatsApp number is already linked to another member" }, { status: 409 });
        }
      }
      updates.whatsapp_number = whatsapp_number || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("business_members")
      .update(updates)
      .eq("id", member_id)
      .eq("business_id", business.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove a team member
export async function DELETE(request: Request) {
  try {
    const user = getDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("member_id");
    if (!memberId) return NextResponse.json({ error: "Member ID is required" }, { status: 400 });

    const business = await getDefaultBusinessId(user.userId);
    if (!business) return NextResponse.json({ error: "No business found" }, { status: 404 });

    // Verify caller is owner
    const { data: callerMember } = await supabase
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", user.userId)
      .maybeSingle();
    if (callerMember?.role !== "owner") {
      return NextResponse.json({ error: "Only the business owner can remove team members" }, { status: 403 });
    }

    // Prevent removing the owner
    const { data: targetMember } = await supabase
      .from("business_members")
      .select("role, whatsapp_number")
      .eq("id", memberId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the business owner" }, { status: 403 });
    }

    // Clean up conversation context if they had WhatsApp linked
    if (targetMember.whatsapp_number) {
      await supabase
        .from("whatsapp_conversation_context")
        .delete()
        .eq("whatsapp_number", targetMember.whatsapp_number)
        .eq("business_id", business.id);
    }

    const { error } = await supabase
      .from("business_members")
      .delete()
      .eq("id", memberId)
      .eq("business_id", business.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Team member removed" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
