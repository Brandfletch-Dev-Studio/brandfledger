"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LiveDataOptions {
  /** Polling interval in ms (default: 30000 = 30s) */
  interval?: number;
  /** Whether to pause when tab is not visible (default: true) */
  pauseWhenHidden?: boolean;
}

interface LiveDataResult<T> {
  data: T | null;
  loading: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  refetch: () => void;
}

/**
 * useLiveData — smart polling hook for live-updating dashboards.
 *
 * - Polls a fetcher function at a regular interval
 * - Pauses when the browser tab is hidden (Page Visibility API)
 * - Only re-renders when data actually changes (deep equality check)
 * - Returns isLive flag for showing a "Live" badge
 *
 * Usage:
 *   const { data, isLive, lastUpdated } = useLiveData({
 *     fetcher: async () => {
 *       const res = await fetch("/api/dashboard/stats");
 *       return res.json();
 *     },
 *     interval: 30000, // 30 seconds
 *   });
 */
export function useLiveData<T>(
  fetcher: () => Promise<T>,
  options: LiveDataOptions = {}
): LiveDataResult<T> {
  const { interval = 30000, pauseWhenHidden = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const dataRef = useRef<string>("");

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      const serialized = JSON.stringify(result);
      if (serialized !== dataRef.current) {
        dataRef.current = serialized;
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err) {
      // Silent fail — keep showing existing data
      console.error("Live data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Polling
  useEffect(() => {
    setIsLive(true);

    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      timer = setInterval(doFetch, interval);
      setIsLive(true);
    };

    const stop = () => {
      clearInterval(timer);
      setIsLive(false);
    };

    const onVisibilityChange = () => {
      if (pauseWhenHidden && document.hidden) {
        stop();
      } else {
        // Tab became visible — fetch immediately then resume polling
        doFetch();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setIsLive(false);
    };
  }, [doFetch, interval, pauseWhenHidden]);

  return { data, loading, isLive, lastUpdated, refetch: doFetch };
}

/**
 * useLiveRefresh — for server component pages.
 * Calls router.refresh() at a regular interval to re-fetch
 * server-rendered data without a full page reload.
 *
 * Usage in a client component wrapper:
 *   useLiveRefresh({ interval: 30000 });
 */
export function useLiveRefresh(options: { interval?: number; pauseWhenHidden?: boolean } = {}) {
  const { interval = 30000, pauseWhenHidden = true } = options;
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const doRefresh = () => {
      // Debounce — don't refresh more than once per 5 seconds
      const now = Date.now();
      if (now - lastRefreshRef.current < 5000) return;
      lastRefreshRef.current = now;

      // Use Next.js router to refresh server components
      // We dispatch a custom event that the parent component can listen to
      window.dispatchEvent(new CustomEvent("live-refresh"));
      if (mounted) setLastUpdated(new Date());
    };

    const start = () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = setInterval(doRefresh, interval);
      if (mounted) setIsLive(true);
    };

    const stop = () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
      if (mounted) setIsLive(false);
    };

    const onVisibilityChange = () => {
      if (pauseWhenHidden && document.hidden) {
        stop();
      } else {
        doRefresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [interval, pauseWhenHidden]);

  return { isLive, lastUpdated };
}
