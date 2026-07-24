// Multi-tenant business selection helper.
// On the server: returns the first business (or the one set via cookie).
// On the client: checks localStorage for the active business ID first.

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
  const activeId = getActiveBusinessId();
  if (activeId) {
    const result = await supabase
      .from("businesses")
      .select("*")
      .eq("id", activeId)
      .maybeSingle();
    if (result.data) return result;
  }
  return supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

export async function getAllBusinesses(supabase: SupabaseClient) {
  return supabase
    .from("businesses")
    .select("id, name, currency, invoice_prefix")
    .order("created_at", { ascending: true });
}
