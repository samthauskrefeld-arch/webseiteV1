"use client";
import { EMPLOYMENT_LABELS, LISTING_STATUS_LABELS, type EmploymentType, type ListingStatus } from "@myminijob/core";
import { Megaphone, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { perHour, relative } from "@/lib/format";

interface Mine {
  id: string;
  title: string;
  status: ListingStatus;
  employmentType: EmploymentType;
  hourlyWageCents: number;
  positions: number;
  occupied: number;
  applicationCount: number;
  updatedAt: string;
  isDemo: boolean;
}
const TONE: Record<ListingStatus, "success" | "warning" | "neutral"> = { PUBLISHED: "success", DRAFT: "warning", PAUSED: "warning", CLOSED: "neutral", ARCHIVED: "neutral" };

export default function Page() {
  const [items, setItems] = useState<Mine[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    api<{ items: Mine[] }>("/me/listings").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  const visible = items?.filter((l) => showArchived || l.status !== "ARCHIVED");
  return (
    <div>
      <PageHeader title="Eigene Inserate" description="Kostenlos inserieren – 1,00 € pro bestätigter Vermittlung.">
        <Button asChild>
          <Link href="/konto/inserate/neu">
            <Plus className="size-4" aria-hidden /> Neues Inserat
          </Link>
        </Button>
      </PageHeader>
      {!visible ? (
        <Spinner label="Lade …" />
      ) : !visible.length ? (
        <Empty icon={<Megaphone className="size-5" />} title="Noch keine Inserate">
          Erstelle dein erstes Inserat in wenigen Schritten.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {visible.map((l) => (
            <li key={l.id}>
              <Link href={`/konto/inserate/${l.id}`} className="flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-surface p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-[14px] text-muted">
                    {EMPLOYMENT_LABELS[l.employmentType]} · {perHour(l.hourlyWageCents)} · geändert {relative(l.updatedAt)}
                  </p>
                </div>
                <span className="text-[14px] text-muted">
                  {l.applicationCount} Bewerbung(en) · {l.occupied}/{l.positions} vergeben
                </span>
                <Badge tone={TONE[l.status]}>{LISTING_STATUS_LABELS[l.status]}</Badge>
                {l.isDemo && <Badge tone="warning">Demo</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items?.some((l) => l.status === "ARCHIVED") && (
        <Button variant="link" className="mt-4" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Archivierte ausblenden" : "Archivierte anzeigen"}
        </Button>
      )}
    </div>
  );
}
