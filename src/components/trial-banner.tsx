"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";
import { AlertTriangle, Crown, X, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const router = useRouter();
  const [trial, setTrial] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadTrial();
  }, []);

  async function loadTrial() {
    try {
      const sb = createClient();
      const { data: biz } = await getDefaultBusiness(sb);
      if (!biz) return;

      const status = biz.subscription_status || "trial";
      const trialEndsAt = biz.trial_ends_at;
      const subscriptionEndsAt = biz.subscription_ends_at;

      let daysLeft = 0;
      if (status === "trial" && trialEndsAt) {
        const diff = new Date(trialEndsAt).getTime() - Date.now();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      setTrial({ status, daysLeft, trialEndsAt, subscriptionEndsAt });
    } catch {}
  }

  if (!trial || dismissed) return null;

  // Active subscription — no banner
  if (trial.status === "active") return null;

  // Trial active
  if (trial.status === "trial") {
    const isUrgent = trial.daysLeft <= 3;
    if (trial.daysLeft <= 5) {
      return (
        <div className={cn(
          "px-3 py-2 flex items-center justify-between gap-2 text-sm",
          isUrgent ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            {isUrgent ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}
            <span className="truncate">
              {trial.daysLeft <= 0
                ? "Trial expired — subscribe to keep access"
                : `${trial.daysLeft} day${trial.daysLeft !== 1 ? "s" : ""} left in your free trial`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant={isUrgent ? "default" : "outline"} className="h-7 text-xs" onClick={() => router.push("/subscription")}>
              <Crown className="h-3 w-3 mr-1" /> Subscribe
            </Button>
            <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  // Expired
  if (trial.status === "expired") {
    return (
      <div className="px-3 py-2 flex items-center justify-between gap-2 text-sm bg-rose-500/10 text-rose-700 dark:text-rose-300">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">Free trial expired — some features are locked</span>
        </div>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => router.push("/subscription")}>
          <Crown className="h-3 w-3 mr-1" /> Subscribe now
        </Button>
      </div>
    );
  }

  return null;
}
