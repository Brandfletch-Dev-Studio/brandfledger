"use client";
import { useState, useEffect } from "react";
import { Lock, Crown, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export function Paywall({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "trial" | "active" | "expired">("loading");
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const res = await fetch("/api/data/account-status");
      if (!res.ok) { setAccess("trial"); return; }
      const data = await res.json();
      setAccess(data.access ?? "trial");
      setDaysLeft(data.days_left ?? 0);
    } catch {
      setAccess("trial"); // fail open — never lock out on network error
    }
  }

  if (access === "loading") {
    return <div className="flex-1">{children}</div>;
  }

  if (access === "expired") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-sm w-full shadow-lg border-destructive/20">
          <CardContent className="flex flex-col items-center text-center gap-4 py-10">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Subscription expired</h2>
              <p className="text-sm text-muted-foreground">
                Your free trial has ended. Upgrade to continue using Brandfledger — all your data is safe.
              </p>
            </div>
            <Button className="gap-1.5 w-full" onClick={() => router.push("/subscription")}>
              <Crown className="h-4 w-4" /> Upgrade Now <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Trial warning banner (3 days or less)
  const showBanner = access === "trial" && daysLeft <= 3;

  return (
    <>
      {showBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {daysLeft === 0
                ? "Your trial expires today!"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial`}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 shrink-0"
            onClick={() => router.push("/subscription")}
          >
            Upgrade
          </Button>
        </div>
      )}
      {children}
    </>
  );
}
