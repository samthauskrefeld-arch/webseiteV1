"use client";
import { QUALIFICATION_KIND_LABELS, type QualificationKind } from "@myminijob/core";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { Autocomplete, type AcItem } from "./autocomplete";

export interface QualificationHit {
  id: string;
  name: string;
  kind: QualificationKind;
  isOfficial: boolean;
  matchedAlias: string | null;
}

export function QualificationPicker({ label = "Qualifikation suchen", kinds, onSelect, placeholder = "z. B. Ele…, BWL, Staplerschein" }: { label?: string; kinds?: QualificationKind[]; onSelect: (q: QualificationHit) => void; placeholder?: string }) {
  const fetcher = useCallback(
    async (term: string, signal: AbortSignal): Promise<AcItem[]> => {
      const r = await api<{ items: QualificationHit[] }>(`/qualifications?q=${encodeURIComponent(term)}${kinds?.length ? `&kinds=${kinds.join(",")}` : ""}`, { signal });
      cache.clear();
      r.items.forEach((q) => cache.set(q.id, q));
      return r.items.map((q) => ({ id: q.id, label: q.name, sub: `${QUALIFICATION_KIND_LABELS[q.kind]}${q.matchedAlias ? ` · gefunden über „${q.matchedAlias}“` : ""}` }));
    },
    [kinds],
  );
  return <Autocomplete label={label} placeholder={placeholder} fetcher={fetcher} onSelect={(it) => onSelect(cache.get(it.id)!)} />;
}
const cache = new Map<string, QualificationHit>();
