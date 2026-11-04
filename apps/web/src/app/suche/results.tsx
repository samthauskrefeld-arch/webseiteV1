"use client";
import { CATEGORY_LABELS, EMPLOYMENT_LABELS, type SearchQuery } from "@myminijob/core";
import { LocateFixed, SearchX, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ListingCard, ListingCardSkeleton, type ListingCardData } from "@/components/listing/listing-card";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError } from "@/lib/api";

interface Result {
  query: SearchQuery;
  parser: "rules" | "ai" | "filters";
  items: ListingCardData[];
  total: number;
  page: number;
  pageSize: number;
  place: { name: string; radiusKm: number } | null;
  locationNote: string | null;
}

function chipsFor(q: SearchQuery): Array<{ key: keyof SearchQuery; label: string; value?: string }> {
  const c: Array<{ key: keyof SearchQuery; label: string; value?: string }> = [];
  if (q.text) c.push({ key: "text", label: `„${q.text}“` });
  if (q.category) c.push({ key: "category", label: CATEGORY_LABELS[q.category] });
  if (q.location) c.push({ key: "location", label: `${q.location}${q.radiusKm ? ` + ${q.radiusKm} km` : ""}` });
  if (q.minHourlyCents !== undefined) c.push({ key: "minHourlyCents", label: `ab ${(q.minHourlyCents / 100).toFixed(2).replace(".", ",")} €/Std.` });
  for (const t of q.employmentTypes ?? []) c.push({ key: "employmentTypes", label: EMPLOYMENT_LABELS[t], value: t });
  if (q.weekend) c.push({ key: "weekend", label: "Wochenende" });
  if (q.evening) c.push({ key: "evening", label: "Abends" });
  if (q.remote) c.push({ key: "remote", label: "Remote" });
  if (q.qualificationKind) c.push({ key: "qualificationKind", label: q.qualificationKind === "STUDIENFACH" ? "Studium gefragt" : "Meister/Fortbildung gefragt" });
  return c;
}

export function SearchResults() {
  const sp = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const q = sp.get("q") ?? "";
  const filters = sp.get("filters");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [q, filters]);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters) params.set("filters", filters);
    else if (q) params.set("q", q);
    params.set("page", String(page));
    api<Result>(`/search?${params}`, { signal: ctrl.signal })
      .then((r) => setData((prev) => (page > 1 && prev ? { ...r, items: [...prev.items, ...r.items] } : r)))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError(e instanceof ApiClientError ? e.message : "Suche fehlgeschlagen");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q, filters, page]);

  const chips = useMemo(() => (data ? chipsFor(data.query) : []), [data]);
  const applyFilters = (next: SearchQuery) => router.push(`/suche?filters=${encodeURIComponent(JSON.stringify(next))}`);
  const removeChip = (key: keyof SearchQuery, value?: string) => {
    if (!data) return;
    const next = { ...data.query } as Record<string, unknown>;
    if (key === "employmentTypes" && value) {
      next.employmentTypes = (data.query.employmentTypes ?? []).filter((t) => t !== value);
      if (!(next.employmentTypes as string[]).length) delete next.employmentTypes;
    } else {
      delete next[key];
      if (key === "location") delete next.radiusKm;
    }
    applyFilters(next as SearchQuery);
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return setError("Standortbestimmung wird von diesem Gerät nicht unterstützt.");
    if (!confirm("Darf My Minijob einmalig deinen Standort verwenden, um den nächstgelegenen Ort zu bestimmen? Die Koordinaten werden nicht gespeichert.")) return;
    setGeoBusy(true);
    api("/consents", { body: { type: "GEOLOCATION", granted: true } }).catch(() => {});
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await api<{ place: { name: string } | null }>(`/places/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          if (!r.place) setError("Für deinen Standort ist noch kein Ort in unserem Verzeichnis – bitte gib einen Ort ein.");
          else applyFilters({ ...(data?.query ?? {}), location: r.place.name, radiusKm: data?.query.radiusKm ?? 25 });
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        setError("Standort nicht verfügbar. Du kannst den Ort auch einfach eintippen.");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const label = sp.get("label");
  return (
    <div className="space-y-6">
      <SearchBar initial={q} />
      <div className="flex flex-wrap items-center gap-2">
        {data?.parser === "ai" && (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text">
            <Sparkles className="size-4" aria-hidden /> KI-Filter
          </span>
        )}
        <AnimatePresence initial={false}>
          {chips.map((c) => (
            <motion.button
              layout={!reduce}
              key={`${c.key}-${c.value ?? ""}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              onClick={() => removeChip(c.key, c.value)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[14px] font-medium hover:border-error/50"
              aria-label={`Filter ${c.label} entfernen`}
            >
              {c.label}
              <X className="size-3.5 text-muted" aria-hidden />
            </motion.button>
          ))}
        </AnimatePresence>
        {!data?.query.location && (
          <Button variant="ghost" size="sm" onClick={useMyLocation} loading={geoBusy}>
            <LocateFixed className="size-4" aria-hidden /> In meiner Nähe
          </Button>
        )}
      </div>

      {data && !data.query.location && !data.query.remote && (q || filters) && (
        <p className="text-[14px] text-muted">Kein Ort angegeben – wir suchen deutschlandweit.</p>
      )}
      {data?.locationNote && <Notice tone="warning">{data.locationNote}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div aria-live="polite" className="text-[15px] text-muted">
        {data && !loading && (
          <>
            {label ? <span className="font-semibold text-text">{label}: </span> : null}
            {data.total === 1 ? "1 Inserat" : `${data.total} Inserate`}
            {data.place ? ` im Umkreis von ${data.place.radiusKm} km um ${data.place.name}` : ""}
          </>
        )}
      </div>

      {loading && page === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.items.length ? (
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}>
          {data.items.map((l) => (
            <motion.div key={l.id} variants={{ hidden: { opacity: 0, y: reduce ? 0 : 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } } }}>
              <ListingCard l={l} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        data && (
          <Empty icon={<SearchX className="size-5" />} title="Keine passenden Inserate">
            Entferne einzelne Filter oder suche in einem größeren Umkreis. Wir zeigen ausschließlich echte, aktive Inserate.
          </Empty>
        )
      )}
      {data && data.items.length < data.total && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} loading={loading}>
            Mehr laden
          </Button>
        </div>
      )}
    </div>
  );
}
