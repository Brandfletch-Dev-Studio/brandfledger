import { getDbUser, query } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getDbUser();
  let businessName: string | undefined;
  let userEmail: string | undefined;

  if (user) {
    userEmail = user.email;
    const businesses = await query("SELECT name FROM businesses WHERE owner_id = $1 ORDER BY created_at LIMIT 1", [user.userId]);
    businessName = businesses[0]?.name;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar businessName={businessName} userEmail={userEmail} />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
