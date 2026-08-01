"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, Crown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const router = useRouter();
  const [trial, setTrial] = useState<{ status: string; daysLeft: number } | null>(null);

  useEffect(() => {
    loadTrial();
  }, []);

  async function loadTrial() {
    try {
      const res = await fetch("/api/data/account-status");
      if (!res.ok) return;
      const data = await res.json();
      const status: string = data.access ?? "trial";
      const daysLeft: number = data.days_left ?? 0;
      setTrial({ status, daysLeft });
    } catch {}
  }

  if (!trial) return null;

  // Don't show for active subscriptions
  if (trial.status === "active") return null;

  const isExpired = trial.status === "expired" || trial.daysLeft <= 0;
  const isLow = trial.daysLeft <= 3;
  const isUrgent = trial.daysLeft <= 5;

  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border-b",
      isExpired
        ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
        : isLow
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
        : "bg-primary/5 text-primary border-primary/10"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isExpired
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          : <Clock className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate font-medium">
          {isExpired
            ? "Trial expired — subscribe to continue"
            : `${trial.daysLeft} day${trial.daysLeft !== 1 ? "s" : ""} left in your free trial`}
        </span>
      </div>
      <Button
        size="sm"
        className="h-7 text-xs gap-1 shrink-0"
        variant={isLow || isExpired ? "default" : "secondary"}
        onClick={() => router.push("/subscription")}
      >
        <Crown className="h-3 w-3" />
        Subscribe
      </Button>
    </div>
  );
}
