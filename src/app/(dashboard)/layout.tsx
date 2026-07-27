import { getDbUser, supabase } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TrialBanner } from "@/components/trial-banner";
import { NavProgress } from "@/components/layout/nav-progress";
import { Paywall } from "@/components/paywall";
import { SplashScreen } from "@/components/splash-screen";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["geniuspulse22@gmail.com"];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let businessName: string | undefined;
  let userEmail: string | undefined;
  let isAdmin = false;

  try {
    const user = getDbUser();
    if (user) {
      userEmail = user.email;
      isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
      const { data: businesses } = await supabase
        .from("businesses")
        .select("name")
        .eq("owner_id", user.userId)
        .order("created_at")
        .limit(1);
      businessName = businesses?.[0]?.name;
    }
  } catch (err) {
    console.error("Layout error:", err);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SplashScreen />
      <NavProgress />
      <TopBar businessName={businessName} userEmail={userEmail} isAdmin={isAdmin} />
      <TrialBanner />
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-20">
        <Paywall>{children}</Paywall>
      </main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
