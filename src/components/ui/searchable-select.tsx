"use client";
import { useState, useRef, useEffect } from "react";
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
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
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Compute dropdown position — capped to available viewport space
  useEffect(() => {
    if (!open || !containerRef.current) return;
    setTimeout(() => searchRef.current?.focus(), 40);

    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 6;
    const searchBarH = 44; // search input height

    const dropW = Math.max(rect.width, minDropdownWidth);
    let left = rect.left;
    if (left + dropW > vw - padding) left = vw - dropW - padding;
    if (left < padding) left = padding;

    const spaceBelow = vh - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    let top: number;
    let listMaxH: number;

    if (spaceBelow >= 180 || spaceBelow >= spaceAbove) {
      // Open below
      top = rect.bottom + 4;
      listMaxH = Math.min(maxHeight, spaceBelow - searchBarH - 8);
    } else {
      // Open above — fit to available space above
      listMaxH = Math.min(maxHeight, spaceAbove - searchBarH - 8);
      top = rect.top - searchBarH - listMaxH - 8;
    }

    // At least 80px for the list
    listMaxH = Math.max(listMaxH, 80);

    setDropStyle({
      position: "fixed",
      top,
      left,
      width: dropW,
      zIndex: 99999,
      // pass listMaxH as a CSS var for the options container
      ["--list-max-h" as any]: `${listMaxH}px`,
    });
  }, [open, minDropdownWidth, maxHeight]);

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
    <>

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
        {/* Sticky search bar */}
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
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#1e293b",
              minWidth: 0,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "#94a3b8", cursor: "pointer", background: "none", border: "none", padding: 0 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {/* Scrollable options list — height capped to available space */}
        <div style={{
          overflowY: "auto",
          maxHeight: `${listMaxH}px`,
          backgroundColor: "white",
          WebkitOverflowScrolling: "touch", // smooth scroll on iOS
        }}>
          {customOption && (
            <button
              key="custom-option"
              type="button"
              onMouseDown={e => { e.preventDefault(); select(customOption.value); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "11px 12px", textAlign: "left",
                fontSize: "14px", cursor: "pointer", border: "none",
                backgroundColor: customOption.value === value ? "#eef2ff" : "white",
                color: customOption.value === value ? "#4f46e5" : "#1e293b",
                fontWeight: customOption.value === value ? 600 : 400,
                borderBottom: "1px solid #f1f5f9",
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
              onMouseDown={e => { e.preventDefault(); select(o.value); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "11px 12px", textAlign: "left",
                fontSize: "14px", cursor: "pointer", border: "none",
                backgroundColor: o.value === value ? "#eef2ff" : "white",
                color: o.value === value ? "#4f46e5" : "#1e293b",
                fontWeight: o.value === value ? 600 : 400,
                borderBottom: "1px solid #f1f5f9",
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
    </>,
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
