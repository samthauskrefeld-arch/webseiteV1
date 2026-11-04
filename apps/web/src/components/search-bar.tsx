"use client";
import { Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

const EXAMPLES = ["Gartenarbeit ab 12,50 Euro Raum Krefeld", "Wochenendjob Dortmund mindestens 15 Euro", "Nachhilfe Mathe remote", "Ausbildung Elektroniker Düsseldorf"];

export function SearchBar({ initial = "", large = false, autoFocus = false }: { initial?: string; large?: boolean; autoFocus?: boolean }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const submit = (value: string) => {
    const v = value.trim();
    router.push(v ? `/suche?q=${encodeURIComponent(v)}` : "/suche");
  };
  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className={cn("group relative flex items-center rounded-[20px] border border-border bg-surface shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-200 focus-within:border-focus focus-within:shadow-[0_0_0_4px_rgb(35_121_216/0.15)]", large ? "h-16" : "h-14")}
      >
        <Sparkles className="ml-5 size-5 shrink-0 text-accent-text" aria-hidden />
        <label htmlFor="mmj-search" className="sr-only">
          Suche in natürlicher Sprache
        </label>
        <input id="mmj-search" name="q" type="search" enterKeyHint="search" autoComplete="off" autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Gartenarbeit ab 12,50 € Raum Krefeld" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted/80" />
        <button type="submit" className="mr-2 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[14px] bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover" aria-label="Suchen">
          <Search className="size-5" aria-hidden />
          <span className="hidden sm:inline">Suchen</span>
        </button>
      </form>
      {large && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Beispielsuchen">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => submit(e)} className="min-h-9 rounded-full border border-border bg-surface/70 px-3 text-[13px] text-muted transition-colors hover:border-accent/50 hover:text-text">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
