import { CATEGORY_LABELS, EMPLOYMENT_LABELS, type EmploymentType, type ListingCategory } from "@myminijob/core";
import { BadgeCheck, CalendarDays, MapPin, Moon, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { perHour } from "@/lib/format";

export interface ListingCardData {
  id: string;
  title: string;
  city: string | null;
  remote: boolean;
  hourlyWageCents: number;
  employmentType: string;
  category: string;
  posterType: string;
  weekend: boolean;
  evening: boolean;
  positions: number;
  openPositions?: number;
  isDemo: boolean;
  businessName?: string | null;
  businessVerified?: boolean;
  business?: { name: string; verificationStatus: string } | null;
  distanceKm?: number | null;
}

export function ListingCard({ l }: { l: ListingCardData }) {
  const businessName = l.businessName ?? l.business?.name ?? null;
  const verified = l.businessVerified ?? l.business?.verificationStatus === "VERIFIED";
  return (
    <Link href={`/inserate/${l.id}`} className="group block rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-float)] active:translate-y-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="accent">{CATEGORY_LABELS[l.category as ListingCategory] ?? l.category}</Badge>
        <Badge>{EMPLOYMENT_LABELS[l.employmentType as EmploymentType] ?? l.employmentType}</Badge>
        {l.isDemo && <Badge tone="warning" title="Beispieldaten aus der Entwicklungsumgebung">Demo</Badge>}
      </div>
      <h3 className="line-clamp-2 text-[17px] font-semibold leading-6 group-hover:text-primary">{l.title}</h3>
      <p className="mt-1 text-[14px] text-muted">
        {l.posterType === "BUSINESS" && businessName ? (
          <span className="inline-flex items-center gap-1">
            {businessName}
            {verified && <BadgeCheck className="size-4 text-accent-text" aria-label="Verifiziertes Unternehmen" />}
          </span>
        ) : (
          "Privat"
        )}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="space-y-1 text-[14px] text-muted">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {l.remote ? "Remote" : (l.city ?? "–")}
            {typeof l.distanceKm === "number" && <span title="Entfernung zwischen Ortsmitten">· ca. {l.distanceKm.toLocaleString("de-DE")} km</span>}
          </p>
          <p className="flex items-center gap-3">
            {l.weekend && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" aria-hidden /> Wochenende
              </span>
            )}
            {l.evening && (
              <span className="inline-flex items-center gap-1">
                <Moon className="size-4" aria-hidden /> Abends
              </span>
            )}
            {typeof l.openPositions === "number" && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden /> {l.openPositions} von {l.positions} frei
              </span>
            )}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-[18px] font-bold text-text">{perHour(l.hourlyWageCents)}</span>
          <span className="text-[12px] text-muted">vereinbart & gezahlt direkt</span>
        </p>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[20px] border border-border bg-surface p-5" aria-hidden>
      <div className="mb-3 h-5 w-32 rounded-full bg-surface-2" />
      <div className="h-5 w-4/5 rounded bg-surface-2" />
      <div className="mt-2 h-4 w-1/3 rounded bg-surface-2" />
      <div className="mt-6 h-5 w-1/2 rounded bg-surface-2" />
    </div>
  );
}
