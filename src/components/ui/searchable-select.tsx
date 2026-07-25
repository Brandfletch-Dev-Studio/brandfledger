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
  /** Minimum dropdown width in px. Defaults to 220. */
  minDropdownWidth?: number;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  maxHeight = 220,
  className = "",
  minDropdownWidth = 220,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  const selected = options.find(o => o.value === value);

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Focus search when opened & compute dropdown position
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const padding = 12; // safe edge padding

        // How wide should the dropdown be?
        const dropW = Math.max(rect.width, minDropdownWidth);

        // Align to trigger's left, but clamp so it doesn't go off-screen right
        let left = rect.left;
        if (left + dropW > vw - padding) {
          left = vw - dropW - padding;
        }
        if (left < padding) left = padding;

        setDropStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left,
          width: dropW,
          zIndex: 9999,
        });
      }
    }
  }, [open, minDropdownWidth]);

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
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full h-8 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={`truncate text-xs ${!selected ? "text-muted-foreground" : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selected && (
            <span
              onClick={clear}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown — rendered via fixed positioning so it escapes any overflow:hidden parent */}
      {open && (
        <div
          className="rounded-xl border bg-card shadow-2xl overflow-hidden"
          style={dropStyle}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-card sticky top-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="overflow-y-auto bg-card" style={{ maxHeight }}>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No results</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={`flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${
                    o.value === value ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate">{o.label}</span>
                  {o.subtitle && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{o.subtitle}</span>
                  )}
                  {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
