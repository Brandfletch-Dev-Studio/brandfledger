"use client";

export default function LayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="h-7 w-7 text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An error occurred while loading this page. Try refreshing.
          </p>
          {error?.digest && (
            <p className="text-xs text-muted-foreground/60 mt-2">Ref: {error.digest}</p>
          )}
          {error?.message && (
            <p className="text-xs text-muted-foreground/60 mt-1">{error.message}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
