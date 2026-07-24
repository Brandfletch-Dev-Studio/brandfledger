"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useCachedFetch — caches data in localStorage for instant page loads.
 * 
 * On first visit: shows loading state (spinner) while fetching.
 * On subsequent visits: renders cached data immediately, refreshes silently.
 * 
 * Usage:
 *   const { data, loading, refreshing, refetch } = useCachedFetch({
 *     key: "transactions",
 *     fetcher: async (sb) => { ... return data },
 *   });
 */
interface CacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  deps?: any[];
  // Cache TTL in ms (default: 5 minutes)
  maxAge?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useCachedFetch<T>({ key, fetcher, deps = [], maxAge = 300000 }: CacheOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Try to load cached data immediately
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`cache:${key}`);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        const age = Date.now() - entry.timestamp;
        if (age < maxAge) {
          // Cache is fresh enough — use it and don't even refresh
          setData(entry.data);
          setLoading(false);
          return;
        }
        // Cache exists but stale — show it immediately, refresh in background
        setData(entry.data);
        setLoading(false);
        setRefreshing(true);
      }
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Fetch fresh data
  const doFetch = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      // Save to cache
      try {
        const entry: CacheEntry<T> = { data: result, timestamp: Date.now() };
        localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
      } catch {
        // localStorage might be full, ignore
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // If we already have cached data (loaded above), just refresh silently
    const cached = localStorage.getItem(`cache:${key}`);
    if (cached) {
      doFetch(true); // silent refresh
    } else {
      doFetch(false); // first load with spinner
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  return { data, loading, refreshing, error, refetch: () => doFetch(true), setData };
}

/**
 * Clear cache for a specific key (e.g., after a mutation)
 */
export function clearCache(key: string) {
  try {
    localStorage.removeItem(`cache:${key}`);
  } catch {
    // ignore
  }
}

/**
 * Clear all caches (e.g., on sign out or business switch)
 */
export function clearAllCaches() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("cache:"));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
