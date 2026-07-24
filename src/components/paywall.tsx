"use client";
import { useState, useEffect } from "react";
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
      const bizId = localStorage.getItem("activeBusinessId");
      const url = bizId ? `/api/data/transactions?business_id=${bizId}` : "/api/data/transactions";
      const res = await fetch(url);
      if (!res.ok) { setStatus("trial"); return; }
      const data = await res.json();
      const biz = data.business;
      if (!biz) { setStatus("trial"); return; }

      const subStatus = biz.subscription_status || "trial";
      const trialEndsAt = biz.trial_ends_at;

      if (subStatus === "active") {
        if (biz.subscription_ends_at && new Date(biz.subscription_ends_at) > new Date()) {
          setStatus("active");
        } else if (!biz.subscription_ends_at) {
          setStatus("active"); // lifetime / no expiry
        } else {
          setStatus("expired");
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
      setStatus("trial"); // fallback — allow access on error
    }
  }

  if (status === "loading") {
    return <div className="flex-1">{children}</div>;
  }

  if (status === "expired") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-sm w-full shadow-lg border-red-100">
          <CardContent className="flex flex-col items-center text-center gap-4 py-10">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <Lock className="h-7 w-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Subscription expired</h2>
              <p className="text-sm text-muted-foreground">Your trial or subscription has ended. Upgrade to continue using Brandfledger.</p>
            </div>
            <Button className="gap-1.5" onClick={() => router.push("/subscription")}>
              <Crown className="h-4 w-4" /> Upgrade Now <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
