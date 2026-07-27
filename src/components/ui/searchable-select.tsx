"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { createPortal } from "react-dom";

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
  maxHeight = 220,
  className = "",
  minDropdownWidth = 200,
  allowCustom = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [listMaxH, setListMaxH] = useState(200);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected ? selected.label : (allowCustom && value ? value : placeholder);
  const hasValue = !!selected || (allowCustom && !!value);

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const trimmedSearch = search.trim();
  const showCustom = allowCustom && trimmedSearch !== "" && !options.some(o => o.label.toLowerCase() === trimmedSearch.toLowerCase());
  const customOption = showCustom ? { value: search, label: `Use: "${search}"` } : null;

  // Close on outside click — use both mousedown and touchstart for mobile
  useEffect(() => {
    if (!open) return;
    function handle(e: Event) {
      const target = e.target as Node;
      const portal = document.getElementById("searchable-select-portal");
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(portal && portal.contains(target))
      ) {
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

  // Compute dropdown position — capped to available viewport space
  const computePosition = useCallback(() => {
    if (!open || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 6;
    const searchBarH = 44;
    const totalBorderH = 2; // top+bottom border

    const dropW = Math.max(rect.width, minDropdownWidth);
    let left = rect.left;
    if (left + dropW > vw - padding) left = vw - dropW - padding;
    if (left < padding) left = padding;

    const spaceBelow = vh - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    let top: number;
    let calculatedMaxH: number;

    if (spaceBelow >= 180 || spaceBelow >= spaceAbove) {
      // Open below
      top = rect.bottom + 4;
      calculatedMaxH = Math.min(maxHeight, spaceBelow - searchBarH - 8);
    } else {
      // Open above
      calculatedMaxH = Math.min(maxHeight, spaceAbove - searchBarH - 8);
      top = rect.top - searchBarH - calculatedMaxH - 8;
    }

    // Minimum 60px
    calculatedMaxH = Math.max(calculatedMaxH, 60);

    setListMaxH(calculatedMaxH);
    setDropStyle({
      position: "fixed",
      top,
      left,
      width: dropW,
      zIndex: 99999,
    });
  }, [open, minDropdownWidth, maxHeight]);

  useEffect(() => {
    if (!open) return;
    // Focus on next tick — works on most mobile browsers when triggered by a tap
    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    computePosition();

    // Recompute on resize (e.g., keyboard opening on mobile)
    const onResize = () => computePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [open, computePosition]);

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

  const dropdown = mounted && open ? createPortal(
    <div
      id="searchable-select-portal"
      style={{
        ...dropStyle,
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
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          maxHeight: listMaxH,
          backgroundColor: "white",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
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
    </div>,
    document.body
  ) : null;

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
      {dropdown}
    </div>
  );
}
