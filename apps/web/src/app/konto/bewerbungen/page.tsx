"use client";
import { APPLICATION_STATUS_LABELS, MEDIATION_STATUS_LABELS, type ApplicationStatus, type MediationStatus } from "@myminijob/core";
import { Inbox, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { date, perHour } from "@/lib/format";

interface App {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  listing: { id: string; title: string; city: string | null; remote: boolean; hourlyWageCents: number; status: string };
  mediation: { id: string; status: MediationStatus } | null;
  conversation: { id: string } | null;
}
const TONE: Record<ApplicationStatus, "neutral" | "accent" | "success" | "error" | "warning"> = { submitted: "neutral", viewed: "accent", shortlisted: "accent", accepted: "success", rejected: "error", withdrawn: "neutral" };

export default function BewerbungenPage() {
  const [items, setItems] = useState<App[] | null>(null);
  const toast = useToast();
  const load = () => api<{ items: App[] }>("/me/applications").then((r) => setItems(r.items));
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);
  return (
    <div>
      <PageHeader title="Bewerbungen" description="Status: Gesendet → Angesehen → Engere Wahl → Zusage oder Absage." />
      {!items ? (
        <Spinner label="Lade …" />
      ) : !items.length ? (
        <Empty icon={<Inbox className="size-5" />} title="Noch keine Bewerbungen">
          <Link className="font-semibold text-accent-text underline" href="/suche">
            Jetzt passende Jobs entdecken
          </Link>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-[20px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/inserate/${a.listing.id}`} className="font-semibold hover:underline">
                    {a.listing.title}
                  </Link>
                  <p className="text-[14px] text-muted">
                    {a.listing.remote ? "Remote" : a.listing.city} · {perHour(a.listing.hourlyWageCents)} · beworben am {date(a.createdAt)}
                  </p>
                </div>
                <Badge tone={TONE[a.status]}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
              </div>
              {a.mediation && <p className="mt-2 text-[14px] font-medium text-success-text">{MEDIATION_STATUS_LABELS[a.mediation.status]}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {a.conversation && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/konto/nachrichten/${a.conversation.id}`}>
                      <MessageCircle className="size-4" aria-hidden /> Chat
                    </Link>
                  </Button>
                )}
                {a.mediation?.status === "PENDING_APPLICANT" && (
                  <Button asChild size="sm">
                    <Link href="/konto/angebote">Zusage beantworten</Link>
                  </Button>
                )}
                {["submitted", "viewed", "shortlisted"].includes(a.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm("Bewerbung wirklich zurückziehen?")) return;
                      try {
                        await api(`/applications/${a.id}/withdraw`, { method: "POST" });
                        await load();
                        toast("Bewerbung zurückgezogen");
                      } catch (e) {
                        toast(e instanceof ApiClientError ? e.message : "Fehler", "error");
                      }
                    }}
                  >
                    Zurückziehen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
