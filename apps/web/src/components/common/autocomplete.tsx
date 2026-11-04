"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

export interface AcItem {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Accessible combobox (WAI-ARIA 1.2 pattern) with debounce and minimum length.
 * Used for the qualification catalog (150 ms debounce, ≥ 2 characters) and places.
 */
export function Autocomplete({ label, placeholder, fetcher, onSelect, minChars = 2, debounceMs = 150, clearOnSelect = true, initial = "", inputId }: { label: string; placeholder?: string; fetcher: (term: string, signal: AbortSignal) => Promise<AcItem[]>; onSelect: (item: AcItem) => void; minChars?: number; debounceMs?: number; clearOnSelect?: boolean; initial?: string; inputId?: string }) {
  const genId = useId();
  const id = inputId ?? genId;
  const listId = `${id}-list`;
  const [term, setTerm] = useState(initial);
  const [items, setItems] = useState<AcItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const t = term.trim();
    if (t.length < minChars) {
      setItems([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetcher(t, ctrl.signal);
        setItems(r);
        setOpen(true);
        setActive(r.length ? 0 : -1);
      } catch {
        /* aborted or failed – keep previous */
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term, minChars, debounceMs, fetcher]);

  const choose = (item: AcItem) => {
    onSelect(item);
    typed.current = false;
    setTerm(clearOnSelect ? "" : item.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={term}
          placeholder={placeholder}
          onChange={(e) => {
            typed.current = true;
            setTerm(e.target.value);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && active >= 0 && items[active]) {
              e.preventDefault();
              choose(items[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-12 w-full rounded-[14px] border border-border bg-surface px-4 pr-10 text-[16px] focus:border-focus focus:outline-none focus:ring-4 focus:ring-focus/20"
        />
        {loading && <Spinner className="absolute right-3 top-3.5 size-5 text-muted" />}
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[14px] border border-border bg-surface p-1 shadow-[var(--shadow-float)]">
          {items.length === 0 ? (
            <li className="px-3 py-2 text-[14px] text-muted">Keine Treffer im Katalog</li>
          ) : (
            items.map((it, i) => (
              <li
                key={it.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-[10px] px-3 py-2", i === active && "bg-surface-2")}
              >
                <span className="block text-[15px] font-medium">{it.label}</span>
                {it.sub && <span className="block text-[13px] text-muted">{it.sub}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
