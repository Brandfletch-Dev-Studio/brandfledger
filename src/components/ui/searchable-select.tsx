"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxHeight?: number;
  className?: string;
  minDropdownWidth?: number;
  allowCustom?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  maxHeight = 240,
  className = "",
  allowCustom = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected ? selected.label : (allowCustom && value ? value : placeholder);
  const hasValue = !!selected || (allowCustom && !!value);

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const trimmedSearch = search.trim();
  const showCustom = allowCustom && trimmedSearch !== "" && !options.some(o => o.label.toLowerCase() === trimmedSearch.toLowerCase());
  const customOption = showCustom ? { value: search, label: `Use: "${search}"` } : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      // Use setTimeout for broader mobile compatibility
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearch("");
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60 transition-all"
      >
        <span className={`truncate text-sm ${!hasValue ? "text-muted-foreground" : "text-foreground"}`}>
          {displayLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasValue && (
            <span onClick={clear} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* INLINE dropdown — no portal, no position:fixed.
          Rendered as a child of the container so it stays inside
          the Radix Dialog focus trap. Uses position: absolute. */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: "4px",
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            flexShrink: 0,
          }}>
            <Search style={{ width: 14, height: 14, color: "#94a3b8", flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "16px", // 16px prevents iOS zoom-on-focus
                color: "#1e293b",
                minWidth: 0,
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                style={{ color: "#94a3b8", cursor: "pointer", background: "none", border: "none", padding: 0, display: "flex" }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>

          {/* Scrollable options list */}
          <div style={{
            overflowY: "auto",
            maxHeight,
            backgroundColor: "white",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}>
            {customOption && (
              <button
                key="custom-option"
                type="button"
                onClick={() => select(customOption.value)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  width: "100%", padding: "11px 12px", textAlign: "left",
                  fontSize: "14px", cursor: "pointer", border: "none",
                  backgroundColor: customOption.value === value ? "#eef2ff" : "white",
                  color: customOption.value === value ? "#4f46e5" : "#1e293b",
                  fontWeight: customOption.value === value ? 600 : 400,
                  borderBottom: "1px solid #f1f5f9",
                  touchAction: "manipulation",
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {customOption.label}
                </span>
                {customOption.value === value && <Check style={{ width: 14, height: 14, flexShrink: 0 }} />}
              </button>
            )}

            {filtered.length === 0 && !customOption ? (
              <p style={{ textAlign: "center", padding: "16px", fontSize: "13px", color: "#94a3b8" }}>
                No results
              </p>
            ) : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => select(o.value)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  width: "100%", padding: "11px 12px", textAlign: "left",
                  fontSize: "14px", cursor: "pointer", border: "none",
                  backgroundColor: o.value === value ? "#eef2ff" : "white",
                  color: o.value === value ? "#4f46e5" : "#1e293b",
                  fontWeight: o.value === value ? 600 : 400,
                  borderBottom: "1px solid #f1f5f9",
                  touchAction: "manipulation",
                }}
                onMouseEnter={e => {
                  if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={e => {
                  if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.label}
                </span>
                {o.subtitle && (
                  <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0, marginLeft: "8px" }}>
                    {o.subtitle}
                  </span>
                )}
                {o.value === value && <Check style={{ width: 14, height: 14, flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
