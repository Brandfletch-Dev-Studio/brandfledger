"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDefaultBusiness } from "@/lib/default-business";

export interface TrialStatus {
  status: "trial" | "active" | "expired" | "loading";
  daysLeft: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
}

export function useTrialStatus(): TrialStatus {
  const [trial, setTrial] = useState<TrialStatus>({
    status: "loading",
    daysLeft: 0,
    trialEndsAt: null,
    subscriptionEndsAt: null,
  });

  useEffect(() => {
    loadTrial();
  }, []);

  async function loadTrial() {
    try {
      const sb = createClient();
      const { data: biz } = await getDefaultBusiness(sb);
      if (!biz) {
        setTrial({ status: "loading", daysLeft: 0, trialEndsAt: null, subscriptionEndsAt: null });
        return;
      }

      const status = (biz as any).subscription_status || "trial";
      const trialEndsAt = (biz as any).trial_ends_at;
      const subscriptionEndsAt = (biz as any).subscription_ends_at;

      let daysLeft = 0;
      if (status === "trial" && trialEndsAt) {
        const diff = new Date(trialEndsAt).getTime() - Date.now();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) {
          setTrial({ status: "expired", daysLeft: 0, trialEndsAt, subscriptionEndsAt });
          return;
        }
      }

      setTrial({ status, daysLeft, trialEndsAt, subscriptionEndsAt });
    } catch {
      setTrial({ status: "loading", daysLeft: 0, trialEndsAt: null, subscriptionEndsAt: null });
    }
  }

  return trial;
}
