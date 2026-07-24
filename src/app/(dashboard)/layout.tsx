import { createClient } from "@/lib/supabase/server";
import { getDefaultBusiness } from "@/lib/default-business";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: business }, { data: { session } }] = await Promise.all([
    getDefaultBusiness(supabase),
    supabase.auth.getSession(),
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar businessName={business?.name} userEmail={session?.user?.email} />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
