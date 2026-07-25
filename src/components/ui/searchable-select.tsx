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
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  maxHeight = 240,
  className = "",
  minDropdownWidth = 240,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const selected = options.find(o => o.value === value);
  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

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

  // Compute position when opening
  useEffect(() => {
    if (!open || !containerRef.current) return;
    setTimeout(() => searchRef.current?.focus(), 40);

    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8;

    const dropW = Math.max(rect.width, minDropdownWidth);
    let left = rect.left;
    if (left + dropW > vw - padding) left = vw - dropW - padding;
    if (left < padding) left = padding;

    // Open below or above depending on space
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedH = Math.min(maxHeight + 52, 300);
    let top: number;
    if (spaceBelow >= estimatedH || spaceBelow >= spaceAbove) {
      top = rect.bottom + 4;
    } else {
      top = rect.top - estimatedH - 4;
    }

    setDropStyle({ position: "fixed", top, left, width: dropW, zIndex: 99999 });
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
      {/* Invisible backdrop to catch outside taps on mobile */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
        onMouseDown={() => { setOpen(false); setSearch(""); }}
      />
      <div
        id="searchable-select-portal"
        style={{
          ...dropStyle,
          backgroundColor: "white",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "10px 12px", borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
        }}>
          <Search style={{ width: 14, height: 14, color: "#94a3b8", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "14px", color: "#1e293b", minWidth: 0,
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "#94a3b8", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {/* Options */}
        <div style={{ overflowY: "auto", maxHeight, backgroundColor: "white" }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: "center", padding: "16px", fontSize: "13px", color: "#94a3b8" }}>No results</p>
          ) : filtered.map(o => (
            <button
              key={o.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(o.value); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "10px 12px", textAlign: "left",
                fontSize: "14px", cursor: "pointer", border: "none",
                backgroundColor: o.value === value ? "#eef2ff" : "white",
                color: o.value === value ? "#4f46e5" : "#1e293b",
                fontWeight: o.value === value ? 600 : 400,
                borderBottom: "1px solid #f1f5f9",
              }}
              onMouseEnter={e => { if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={e => { if (o.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white"; }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
              {o.subtitle && (
                <span style={{ fontSize: "12px", color: "#94a3b8", flexShrink: 0, marginLeft: "8px" }}>{o.subtitle}</span>
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
        className="flex items-center justify-between w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className={`truncate text-sm ${!selected ? "text-gray-400" : "text-gray-900"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selected && (
            <span onClick={clear} className="text-gray-400 hover:text-gray-600 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {dropdown}
    </div>
  );
}
