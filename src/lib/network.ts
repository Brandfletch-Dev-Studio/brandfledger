// Network resilience helpers.
// On very slow/flaky mobile connections, fetch() dies before the request
// completes and Supabase surfaces it as "TypeError: Failed to fetch".
// This lets us detect that case and keep retrying instead of just failing once.

export function isNetworkError(err: { message?: string; name?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const name = (err.name ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network request failed") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    name.includes("authretryablefetcherror")
  );
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const CONNECTION_ERROR_MESSAGE =
  "Connection problem — your entry is saved locally and we'll keep retrying.";

/**
 * Runs `action` and, if it fails with a network error, keeps retrying in the
 * background (every `intervalMs`, and immediately when the browser regains
 * connectivity) until it succeeds or fails with a *real* error.
 * Returns only once the action has truly succeeded or truly failed.
 */
export async function retryUntilOnline<E extends { message?: string; name?: string }>(
  action: () => Promise<{ error: E | null }>,
  opts: { intervalMs?: number; onRetrying?: (retrying: boolean) => void } = {}
): Promise<{ error: E | null }> {
  const { intervalMs = 4000, onRetrying } = opts;
  let { error } = await action();
  if (!error || !isNetworkError(error)) return { error };

  onRetrying?.(true);
  try {
    while (true) {
      const woken = new Promise<void>((resolve) => {
        const handler = () => { window.removeEventListener("online", handler); resolve(); };
        window.addEventListener("online", handler);
        setTimeout(() => { window.removeEventListener("online", handler); resolve(); }, intervalMs);
      });
      await woken;
      ({ error } = await action());
      if (!error) return { error: null };
      if (!isNetworkError(error)) return { error };
    }
  } finally {
    onRetrying?.(false);
  }
}
