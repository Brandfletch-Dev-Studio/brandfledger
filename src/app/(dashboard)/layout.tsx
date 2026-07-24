import { createClient } from "@/lib/supabase/server";
import { getDefaultBusiness } from "@/lib/default-business";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";

// TEMPORARY: auth removed while it's being rebuilt from scratch.
// This app is fully publicly accessible right now — no login required.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: business } = await getDefaultBusiness(supabase);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar businessName={business?.name} />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
