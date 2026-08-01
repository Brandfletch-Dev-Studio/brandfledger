"use client";

export function LiveBadge({ isLive, lastUpdated }: { isLive: boolean; lastUpdated?: Date | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      </span>
      <span className="font-medium">{isLive ? "Live" : "Paused"}</span>
      {lastUpdated && (
        <span className="hidden sm:inline text-muted-foreground/60">
          · {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );
}
