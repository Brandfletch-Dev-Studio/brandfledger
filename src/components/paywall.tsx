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
      if (!biz) { setStatus("loading"); return; }

      const subStatus = biz.subscription_status || "trial";
      const trialEndsAt = biz.trial_ends_at;

      if (subStatus === "active") {
        // Check if subscription still valid
        if (biz.subscription_ends_at && new Date(biz.subscription_ends_at) > new Date()) {
          setStatus("active");
        } else {
          // Subscription expired — check if they were on trial
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

  if (status === "loading") return <>{children}</>;
  if (status === "trial" || status === "active") return <>{children}</>;

  // Expired — show paywall
  return (
    <div className="p-3 sm:p-6">
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Your free trial has ended</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Subscribe to keep creating transactions, invoices, and managing your business finances.
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => router.push("/subscription")}>
            <Crown className="h-4 w-4 mr-2" /> Choose a plan
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <p className="text-xs text-muted-foreground">
            You can still view your data — just not add new entries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
