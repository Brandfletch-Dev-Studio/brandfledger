// Multi-tenant business selection helper.
// Scopes businesses by the authenticated user's ID.

import type { SupabaseClient } from "@supabase/supabase-js";

export function getActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("activeBusinessId");
}

export function setActiveBusinessId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("activeBusinessId", id);
}

export async function getDefaultBusiness(supabase: SupabaseClient) {
  // Check localStorage for active business (client-side only)
  const activeId = getActiveBusinessId();
  if (activeId) {
    const result = await supabase
      .from("businesses")
      .select("*")
      .eq("id", activeId)
      .maybeSingle();
    if (result.data) return result;
  }

  // Fall back to the first business the user owns
  // If RLS is enabled, this will only return the user's businesses
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.user?.id) {
    const result = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", session.session.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (result.data) return result;
  }

  // No auth — return first business (legacy fallback)
  return supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

export async function getAllBusinesses(supabase: SupabaseClient) {
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.user?.id) {
    return supabase
      .from("businesses")
      .select("id, name, currency, invoice_prefix")
      .eq("owner_id", session.session.user.id)
      .order("created_at", { ascending: true });
  }
  // No auth — return all (legacy)
  return supabase
    .from("businesses")
    .select("id, name, currency, invoice_prefix")
    .order("created_at", { ascending: true });
}
