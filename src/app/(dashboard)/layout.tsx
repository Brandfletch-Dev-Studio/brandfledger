import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // FIX: use getUser() (verifies JWT with Supabase server) rather than getSession()
  // which only reads local cookies and can return stale/no session after onboarding redirect.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // FIX: if user is authenticated but has no business yet, send them to onboarding
  // instead of letting them see a broken empty dashboard
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  if (!businesses || businesses.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {children}
      </main>
    </div>
  );
}
