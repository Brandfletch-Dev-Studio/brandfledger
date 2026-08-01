"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/hooks/use-live-data";
import { LiveBadge } from "@/components/ui/live-badge";

/**
 * DashboardLiveRefresh — drop into a server component page.
 * Polls router.refresh() to re-fetch server-rendered data
 * without a full page reload. Shows a Live badge.
 */
export function DashboardLiveRefresh({ interval = 30000 }: { interval?: number }) {
  const router = useRouter();
  const { isLive, lastUpdated } = useLiveRefresh({ interval });

  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener("live-refresh", handler);
    return () => window.removeEventListener("live-refresh", handler);
  }, [router]);

  return <LiveBadge isLive={isLive} lastUpdated={lastUpdated} />;
}
