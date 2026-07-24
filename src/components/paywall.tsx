"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { Lock, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function Paywall({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "trial" | "active" | "expired">("loading");

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const sb = createClient();
      const { data: biz } = await getDefaultBusiness(sb);
      if (!biz) { setStatus("trial"); return; }

      const subStatus = biz.subscription_status || "trial";
      const trialEndsAt = biz.trial_ends_at;

      if (subStatus === "active") {
        if (biz.subscription_ends_at && new Date(biz.subscription_ends_at) > new Date()) {
          setStatus("active");
        } else {
          if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
            setStatus("trial");
          } else {
            setStatus("expired");
          }
        }
      } else if (subStatus === "trial") {
        if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
          setStatus("trial");
        } else {
          setStatus("expired");
        }
      } else {
        setStatus("expired");
      }
    } catch {
      setStatus("trial"); // Fail open during errors
    }
  }

  if (status === "loading" || status === "trial" || status === "active") return <>{children}</>;

  // Expired — allow viewing data but show a dismissible upsell banner
  return (
    <div>
      <div className="px-3 py-2 flex items-center justify-between gap-2 text-sm bg-rose-500/10 text-rose-700 dark:text-rose-300">
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">Free trial ended — upgrade to add new entries</span>
        </div>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => router.push("/subscription")}>
          <Crown className="h-3 w-3 mr-1" /> Subscribe
        </Button>
      </div>
      <div className="opacity-60 pointer-events-none">{children}</div>
    </div>
  );
}
