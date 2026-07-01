// Small helper for handling flaky mobile connections gracefully.
// Supabase auth calls don't throw on network failure — they return an
// AuthRetryableFetchError-style object with message "Failed to fetch".
// This lets us distinguish "your connection dropped" from a real error,
// and retry once automatically before bothering the user.

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
  "Connection problem — check your signal and try again.";
