"use client";
import { MEDIATION_STATUS_LABELS, type MediationStatus } from "@myminijob/core";
import { Handshake, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DisputeDialog, ReviewDialog } from "@/components/account/mediation-dialogs";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { date, perHour } from "@/lib/format";

interface Offer {
  id: string;
  status: MediationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  posterCompletedAt: string | null;
  applicantCompletedAt: string | null;
  listing: { id: string; title: string; city: string | null; remote: boolean; hourlyWageCents: number; startDate: string | null; owner: { profile: { username: string } | null }; business: { name: string } | null };
  application: { id: string; conversation: { id: string } | null };
  reviews: { id: string }[];
  disputes: { id: string }[];
}

export default function AngebotePage() {
  const [items, setItems] = useState<Offer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<Offer | null>(null);
  const [disputeFor, setDisputeFor] = useState<Offer | null>(null);
  const toast = useToast();
  const load = () => api<{ items: Offer[] }>("/me/offers").then((r) => setItems(r.items));
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);
  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      await load();
      toast(ok);
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Fehler", "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <PageHeader title="Angenommene Angebote" description="Zusagen von Auftraggebern. Für dich ist das immer kostenlos." />
      {!items ? (
        <Spinner label="Lade …" />
      ) : !items.length ? (
        <Empty icon={<Handshake className="size-5" />} title="Noch keine Zusagen">
          Sobald dir jemand zusagt, erscheint das hier.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id} className="rounded-[20px] border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/inserate/${o.listing.id}`} className="text-[17px] font-semibold hover:underline">
                    {o.listing.title}
                  </Link>
                  <p className="text-[14px] text-muted">
                    {o.listing.business?.name ?? o.listing.owner.profile?.username} · {o.listing.remote ? "Remote" : o.listing.city} · {perHour(o.listing.hourlyWageCents)}
                  </p>
                </div>
                <Badge tone={o.status === "PENDING_APPLICANT" ? "warning" : ["CONFIRMED", "COMPLETED"].includes(o.status) ? "success" : "neutral"}>{MEDIATION_STATUS_LABELS[o.status]}</Badge>
              </div>
              {o.status === "PENDING_APPLICANT" && (
                <div className="mt-4 space-y-3">
                  <Notice tone="info">Bitte antworte bis {date(o.expiresAt)}. Mit deiner Annahme kommt die Vermittlung zustande; die Vergütung vereinbart und zahlt ihr direkt untereinander.</Notice>
                  <div className="flex flex-wrap gap-2">
                    <Button loading={busy === o.id} onClick={() => act(o.id, () => api(`/mediations/${o.id}/respond`, { body: { accept: true } }), "Zusage angenommen")}>
                      Zusage annehmen
                    </Button>
                    <Button variant="secondary" disabled={busy === o.id} onClick={() => confirm("Zusage wirklich ablehnen?") && act(o.id, () => api(`/mediations/${o.id}/respond`, { body: { accept: false } }), "Zusage abgelehnt")}>
                      Ablehnen
                    </Button>
                  </div>
                </div>
              )}
              {o.status === "CONFIRMED" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {o.applicantCompletedAt ? (
                    <p className="text-[14px] text-muted">Du hast den Abschluss bestätigt{o.posterCompletedAt ? "" : " – wartet auf den Auftraggeber"}.</p>
                  ) : (
                    <Button variant="secondary" loading={busy === o.id} onClick={() => act(o.id, () => api(`/mediations/${o.id}/complete`, { method: "POST" }), "Als erledigt markiert")}>
                      Auftrag erledigt
                    </Button>
                  )}
                  {!o.disputes.length && (
                    <Button variant="ghost" onClick={() => setDisputeFor(o)}>
                      Problem melden
                    </Button>
                  )}
                </div>
              )}
              {o.status === "COMPLETED" && !o.reviews.length && (
                <Button className="mt-4" variant="secondary" onClick={() => setReviewFor(o)}>
                  <Star className="size-4" aria-hidden /> Bewerten
                </Button>
              )}
              {o.disputes.length > 0 && <p className="mt-3 text-[14px] text-warning-text">Ein Streitfall wird geprüft.</p>}
              {o.application.conversation && (
                <Button asChild variant="ghost" size="sm" className="mt-2">
                  <Link href={`/konto/nachrichten/${o.application.conversation.id}`}>
                    <MessageCircle className="size-4" aria-hidden /> Chat öffnen
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ReviewDialog target={reviewFor} onClose={() => setReviewFor(null)} onDone={load} />
      <DisputeDialog target={disputeFor} onClose={() => setDisputeFor(null)} onDone={load} />
    </div>
  );
}

