"use client";
import { useState, useEffect } from "react";
import { AlertTriangle, Crown, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const router = useRouter();
  const [trial, setTrial] = useState<{ status: string; daysLeft: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

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

  if (!trial || dismissed) return null;

  // Only show when trial is running low (≤5 days) or expired
  if (trial.status === "active") return null;
  if (trial.status === "trial" && trial.daysLeft > 5) return null;

  const isExpired = trial.status === "expired" || trial.daysLeft <= 0;
  const isLow = trial.daysLeft <= 3;

  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-4 py-2 text-sm",
      isExpired ? "bg-red-600 text-white" : isLow ? "bg-amber-500 text-white" : "bg-primary/10 text-primary"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isExpired
          ? <AlertTriangle className="h-4 w-4 shrink-0" />
          : <Clock className="h-4 w-4 shrink-0" />}
        <span className="truncate">
          {isExpired
            ? "Your trial has expired."
            : `${trial.daysLeft} day${trial.daysLeft !== 1 ? "s" : ""} left in your trial.`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="secondary" className="h-7 text-xs gap-1"
          onClick={() => router.push("/subscription")}>
          <Crown className="h-3 w-3" /> Upgrade
        </Button>
        {!isExpired && (
          <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
