"use client";
import {
  APPLICATION_STATUS_LABELS,
  FEE_BUTTON_LABEL,
  FEE_NOTICE_VERSION,
  feeNoticeText,
  LISTING_STATUS_LABELS,
  MEDIATION_STATUS_LABELS,
  QUALIFICATION_KIND_LABELS,
  type ApplicationStatus,
  type ListingStatus,
  type MediationStatus,
  type QualificationKind,
} from "@myminijob/core";
import { ChevronDown, ExternalLink, FileText, MessageCircle, Pencil, Star, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DisputeDialog, ReviewDialog } from "@/components/account/mediation-dialogs";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/field";
import { Empty } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError, newKey } from "@/lib/api";
import { date, euro } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Snapshot {
  username: string;
  headline: string;
  summary: string;
  about: string | null;
  skills: string[];
  region: { city: string | null } | null;
  experience: Array<{ title: string; organization?: string; from?: string; to?: string }> | null;
  education: Array<{ title: string; institution?: string }> | null;
  qualifications: Array<{ id: string; name: string; kind: QualificationKind; status: string }> | null;
  languages: Array<{ name: string; level: string }> | null;
  availability: string | null;
}
interface AppRow {
  id: string;
  status: ApplicationStatus;
  message: string;
  createdAt: string;
  applicantUsername: string;
  resumeSnapshot: Snapshot;
  mediation: { id: string; status: MediationStatus; expiresAt: string; posterCompletedAt: string | null } | null;
  documents: { fileId: string }[];
  conversation: { id: string } | null;
}
interface DocInfo {
  file: { id: string; originalName: string; scanStatus: string };
}
interface Data {
  listing: { id: string; title: string; positions: number; status: ListingStatus; occupied: number };
  applications: AppRow[];
}

const ACTIONS: Record<ListingStatus, Array<{ action: string; label: string; variant?: "secondary" | "primary" | "ghost" }>> = {
  DRAFT: [
    { action: "publish", label: "Veröffentlichen", variant: "primary" },
    { action: "archive", label: "Archivieren", variant: "ghost" },
  ],
  PUBLISHED: [
    { action: "pause", label: "Pausieren", variant: "secondary" },
    { action: "close", label: "Schließen", variant: "ghost" },
  ],
  PAUSED: [
    { action: "resume", label: "Fortsetzen", variant: "primary" },
    { action: "close", label: "Schließen", variant: "ghost" },
  ],
  CLOSED: [{ action: "archive", label: "Archivieren", variant: "ghost" }],
  ARCHIVED: [],
};

export default function PosterListingPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<AppRow | null>(null);
  const [reviewFor, setReviewFor] = useState<{ id: string } | null>(null);
  const [disputeFor, setDisputeFor] = useState<{ id: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = () =>
    api<Data>(`/listings/${id}/applications`)
      .then(setD)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Fehler"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
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

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!d) return <Spinner label="Lade …" />;
  const { listing } = d;
  const full = listing.occupied >= listing.positions;
  return (
    <div className="space-y-6">
      <PageHeader title={listing.title} back="/konto/inserate" backLabel="Eigene Inserate">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/inserate/${listing.id}`}>
              <ExternalLink className="size-4" aria-hidden /> Ansehen
            </Link>
          </Button>
          {listing.status !== "ARCHIVED" && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/konto/inserate/${listing.id}/bearbeiten`}>
                <Pencil className="size-4" aria-hidden /> Bearbeiten
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-surface p-4">
        <Badge tone={listing.status === "PUBLISHED" ? "success" : "warning"}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
        <span className="inline-flex items-center gap-1 text-[15px]">
          <Users className="size-4 text-muted" aria-hidden /> {listing.occupied} von {listing.positions} Plätzen vergeben
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {ACTIONS[listing.status].map((a) => (
            <Button key={a.action} size="sm" variant={a.variant} loading={busy === a.action} onClick={() => run(a.action, () => api(`/listings/${listing.id}/status`, { body: { action: a.action } }), "Status geändert")}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      <h2>Bewerbungen ({d.applications.length})</h2>
      {!d.applications.length ? (
        <Empty icon={<Users className="size-5" />} title="Noch keine Bewerbungen">
          {listing.status === "PUBLISHED" ? "Sobald sich jemand bewirbt, siehst du es hier und per Benachrichtigung." : "Veröffentliche das Inserat, um Bewerbungen zu erhalten."}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {d.applications.map((a) => {
            const s = a.resumeSnapshot;
            const expanded = open === a.id;
            const m = a.mediation;
            return (
              <li key={a.id} className="overflow-hidden rounded-[20px] border border-border bg-surface">
                <button
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                  aria-expanded={expanded}
                  onClick={async () => {
                    setOpen(expanded ? null : a.id);
                    if (!expanded && a.status === "submitted") {
                      await api(`/applications/${a.id}`).catch(() => {});
                      load();
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.applicantUsername}</p>
                    <p className="truncate text-[14px] text-muted">{s.headline || "Ohne Kurzprofil"} · {date(a.createdAt)}</p>
                  </div>
                  <Badge tone={a.status === "accepted" ? "success" : a.status === "rejected" ? "error" : a.status === "submitted" ? "warning" : "neutral"}>{APPLICATION_STATUS_LABELS[a.status]}</Badge>
                  <ChevronDown className={cn("size-5 text-muted transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
                {expanded && (
                  <div className="space-y-4 border-t border-border p-4">
                    {a.message && <p className="rounded-[14px] bg-surface-2 p-3 text-[15px]">„{a.message}“</p>}
                    <ApplicantDetails s={s} appId={a.id} hasDocs={a.documents.length > 0} />
                    {m && (
                      <Notice tone={m.status === "PENDING_APPLICANT" ? "warning" : ["CONFIRMED", "COMPLETED"].includes(m.status) ? "success" : "info"} title={MEDIATION_STATUS_LABELS[m.status]}>
                        {m.status === "PENDING_APPLICANT" && `Die Person kann bis ${date(m.expiresAt)} annehmen. Erst dann entsteht die Gebühr von 1,00 €.`}
                        {m.status === "CONFIRMED" && "Die Vermittlungsgebühr wurde berechnet. Die Rechnung findest du unter Rechnungen."}
                      </Notice>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {a.conversation && (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/konto/nachrichten/${a.conversation.id}`}>
                            <MessageCircle className="size-4" aria-hidden /> Chat
                          </Link>
                        </Button>
                      )}
                      {["submitted", "viewed", "shortlisted"].includes(a.status) && (
                        <>
                          <Button size="sm" disabled={full || listing.status === "CLOSED" || listing.status === "ARCHIVED"} onClick={() => setAcceptFor(a)}>
                            Zusagen …
                          </Button>
                          {a.status !== "shortlisted" && (
                            <Button size="sm" variant="secondary" loading={busy === `s${a.id}`} onClick={() => run(`s${a.id}`, () => api(`/applications/${a.id}/shortlist`, { method: "POST" }), "Auf die engere Wahl gesetzt")}>
                              Engere Wahl
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" loading={busy === `r${a.id}`} onClick={() => confirm("Bewerbung absagen?") && run(`r${a.id}`, () => api(`/applications/${a.id}/reject`, { body: {} }), "Abgesagt")}>
                            Absagen
                          </Button>
                        </>
                      )}
                      {m?.status === "PENDING_APPLICANT" && (
                        <Button size="sm" variant="ghost" loading={busy === `w${m.id}`} onClick={() => confirm("Zusage zurücknehmen? Es fällt keine Gebühr an.") && run(`w${m.id}`, () => api(`/mediations/${m.id}/withdraw`, { method: "POST" }), "Zusage zurückgenommen")}>
                          Zusage zurücknehmen
                        </Button>
                      )}
                      {m?.status === "CONFIRMED" && (
                        <>
                          {!m.posterCompletedAt ? (
                            <Button size="sm" variant="secondary" loading={busy === `c${m.id}`} onClick={() => run(`c${m.id}`, () => api(`/mediations/${m.id}/complete`, { method: "POST" }), "Als erledigt markiert")}>
                              Auftrag erledigt
                            </Button>
                          ) : (
                            <span className="self-center text-[14px] text-muted">Abschluss bestätigt – wartet auf die Person</span>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setDisputeFor({ id: m.id })}>
                            Storno / Problem
                          </Button>
                        </>
                      )}
                      {m?.status === "COMPLETED" && (
                        <Button size="sm" variant="secondary" onClick={() => setReviewFor({ id: m.id })}>
                          <Star className="size-4" aria-hidden /> Bewerten
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AcceptDialog app={acceptFor} listingTitle={listing.title} onClose={() => setAcceptFor(null)} onDone={load} />
      <ReviewDialog target={reviewFor} onClose={() => setReviewFor(null)} onDone={load} />
      <DisputeDialog target={disputeFor} onClose={() => setDisputeFor(null)} onDone={load} />
    </div>
  );
}

const Q_STATUS: Record<string, string> = { SELF_DECLARED: "Selbstangabe", PENDING_REVIEW: "Nachweis in Prüfung", VERIFIED: "geprüft", REJECTED: "Nachweis abgelehnt" };

function ApplicantDetails({ s, appId, hasDocs }: { s: Snapshot; appId: string; hasDocs: boolean }) {
  const [docs, setDocs] = useState<DocInfo[] | null>(null);
  useEffect(() => {
    if (hasDocs) api<{ documents: DocInfo[] }>(`/applications/${appId}`).then((r) => setDocs(r.documents)).catch(() => setDocs([]));
  }, [appId, hasDocs]);
  return (
    <div className="grid gap-4 text-[15px] sm:grid-cols-2">
      <div className="space-y-2">
        {s.summary && <p>{s.summary}</p>}
        {s.region?.city && <p className="text-muted">Region: {s.region.city}</p>}
        {s.availability && <p className="text-muted">Verfügbarkeit: {s.availability}</p>}
        {s.skills.length > 0 && <p>Kompetenzen: {s.skills.join(", ")}</p>}
        {s.languages && s.languages.length > 0 && <p>Sprachen: {s.languages.map((l) => `${l.name} (${l.level})`).join(", ")}</p>}
      </div>
      <div className="space-y-2">
        {s.qualifications && s.qualifications.length > 0 && (
          <div>
            <p className="font-semibold">Qualifikationen</p>
            <ul>
              {s.qualifications.map((q) => (
                <li key={q.id}>
                  {q.name} <span className="text-[13px] text-muted">({QUALIFICATION_KIND_LABELS[q.kind]}, {Q_STATUS[q.status] ?? q.status})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.experience && s.experience.length > 0 && (
          <div>
            <p className="font-semibold">Erfahrung</p>
            {s.experience.map((x, i) => (
              <p key={i}>
                {x.title}
                {x.organization ? ` · ${x.organization}` : ""}
              </p>
            ))}
          </div>
        )}
        {s.education && s.education.length > 0 && (
          <div>
            <p className="font-semibold">Ausbildung & Studium</p>
            {s.education.map((x, i) => (
              <p key={i}>{x.title}</p>
            ))}
          </div>
        )}
        {docs?.map((d) => (
          <a key={d.file.id} href={`/api/v1/files/${d.file.id}`} className="flex items-center gap-2 font-medium text-accent-text hover:underline">
            <FileText className="size-4" aria-hidden /> {d.file.originalName}
            {d.file.scanStatus === "NOT_SCANNED" && <Badge tone="warning">nicht virengeprüft</Badge>}
          </a>
        ))}
      </div>
    </div>
  );
}

/** Binding, fee-bearing confirmation. Shows fee, listing and person; button per § 312j BGB. */
function AcceptDialog({ app, listingTitle, onClose, onDone }: { app: AppRow | null; listingTitle: string; onClose: () => void; onDone: () => void }) {
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());
  const toast = useToast();
  useEffect(() => {
    setAck(false);
    setErr(null);
    key.current = newKey();
  }, [app?.id]);
  if (!app) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Verbindlich zusagen" description="Bitte prüfe die Angaben.">
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[14px] bg-surface-2 p-4 text-[15px]">
        <dt className="text-muted">Inserat</dt>
        <dd className="font-medium">{listingTitle}</dd>
        <dt className="text-muted">Person</dt>
        <dd className="font-medium">{app.applicantUsername}</dd>
        <dt className="text-muted">Vermittlungsgebühr</dt>
        <dd className="font-bold">{euro(100)} (einmalig)</dd>
      </dl>
      <p className="mb-4 text-[15px] leading-6">{feeNoticeText(listingTitle, app.applicantUsername)}</p>
      <Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} label="Ich habe den Gebührenhinweis gelesen." />
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Details: <Link href="/rechtliches/gebuehren" className="underline" target="_blank">Gebühreninformationen</Link> · Hinweis-Version {FEE_NOTICE_VERSION}
      </p>
      {err && <Notice tone="error" className="mb-3">{err}</Notice>}
      <Button
        className="w-full"
        size="lg"
        disabled={!ack}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await api(`/applications/${app.id}/accept`, { body: { feeAcknowledged: true, feeNoticeVersion: FEE_NOTICE_VERSION }, headers: { "idempotency-key": key.current } });
            toast(`Zusage an ${app.applicantUsername} gesendet`);
            onClose();
            onDone();
          } catch (e) {
            setErr(e instanceof ApiClientError ? e.message : "Fehler");
          } finally {
            setBusy(false);
          }
        }}
      >
        {FEE_BUTTON_LABEL}
      </Button>
      <p className="mt-2 text-center text-[13px] text-muted">Die Arbeitsvergütung ist nicht Teil dieser Gebühr.</p>
    </Dialog>
  );
}
