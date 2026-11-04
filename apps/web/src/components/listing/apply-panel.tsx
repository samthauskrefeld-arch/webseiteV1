"use client";
import { CheckCircle2, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiClientError, newKey } from "@/lib/api";
import { useSession } from "@/lib/session";
import { SlideToApply } from "./slide-to-apply";

interface FileItem {
  id: string;
  originalName: string;
  purpose: string;
  scanStatus: string;
}
interface ProfileData {
  profile: { username: string; city: string | null; skills: string[] };
  resume: { headline: string; summary: string; experience: unknown[]; qualifications: unknown[] };
}

export function ApplyPanel({ listingId, existing, open }: { listingId: string; existing: { id: string; status: string } | null; open: boolean }) {
  const { me } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(!!existing);
  const [buttonBusy, setButtonBusy] = useState(false);
  const keyRef = useRef(newKey()); // one key per gesture/attempt → backend saves exactly once
  const inflight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!me || existing) return;
    api<ProfileData>("/me/profile").then(setProfile).catch(() => {});
    api<{ items: FileItem[] }>("/me/files").then((r) => setFiles(r.items.filter((f) => f.purpose === "RESUME_DOC" || f.purpose === "QUALIFICATION_PROOF"))).catch(() => {});
  }, [me, existing]);

  if (!me)
    return (
      <Notice tone="info" title="Zum Bewerben anmelden">
        Bewerben ist kostenlos.{" "}
        <Link className="font-semibold text-accent-text underline" href={`/anmelden?next=/inserate/${listingId}`}>
          Anmelden
        </Link>{" "}
        oder{" "}
        <Link className="font-semibold text-accent-text underline" href={`/registrieren?next=/inserate/${listingId}`}>
          Konto erstellen
        </Link>
        .
      </Notice>
    );
  if (done)
    return (
      <Notice tone="success" title="Du hast dich beworben">
        Den Status findest du unter{" "}
        <Link href="/konto/bewerbungen" className="font-semibold underline">
          Mein Konto › Bewerbungen
        </Link>
        .
      </Notice>
    );
  if (!open) return <Notice tone="info">Dieses Inserat nimmt derzeit keine Bewerbungen an.</Notice>;
  if (!me.emailVerified)
    return (
      <Notice tone="warning" title="E-Mail bestätigen">
        Bitte bestätige zuerst deine E-Mail-Adresse. Den Link haben wir dir geschickt.
      </Notice>
    );

  const submit = (): Promise<boolean> => {
    if (inflight.current) return inflight.current; // slider and button share one request
    setError(null);
    inflight.current = api(`/listings/${listingId}/applications`, { body: { message, documentFileIds: selected }, headers: { "idempotency-key": keyRef.current } })
      .then(() => {
        setTimeout(() => setDone(true), 1200);
        return true;
      })
      .catch((e) => {
        setError(e instanceof ApiClientError ? e.message : "Bewerbung konnte nicht gesendet werden.");
        if (e instanceof ApiClientError && e.status >= 400 && e.status < 500 && e.status !== 409) keyRef.current = newKey();
        inflight.current = null;
        return false;
      });
    return inflight.current;
  };

  const incomplete = profile && !profile.resume.headline && !profile.resume.experience.length && !profile.resume.qualifications.length;
  return (
    <div className="space-y-5">
      <section aria-labelledby="step1" className="rounded-[20px] border border-border p-4">
        <h3 id="step1" className="mb-2 flex items-center gap-2 text-[16px]">
          <UserRound className="size-5 text-accent-text" aria-hidden /> 1. Profil prüfen
        </h3>
        {profile ? (
          <div className="text-[15px]">
            <p className="font-semibold">{profile.profile.username}</p>
            <p className="text-muted">{profile.resume.headline || "Noch keine Kurzbeschreibung"}</p>
            <p className="mt-1 text-[14px] text-muted">
              {profile.resume.qualifications.length} Qualifikation(en) · {profile.resume.experience.length} Station(en) Erfahrung
            </p>
            {incomplete && <p className="mt-2 text-[14px] text-warning-text">Tipp: Ein ausgefüllter Lebenslauf erhöht deine Chancen.</p>}
            <Link href="/konto/lebenslauf" className="mt-2 inline-block text-[14px] font-semibold text-accent-text underline">
              Lebenslauf bearbeiten
            </Link>
            <p className="mt-1 text-[13px] text-muted">Es werden nur Angaben geteilt, die du nicht auf „Nur ich“ gestellt hast.</p>
          </div>
        ) : (
          <p className="text-[15px] text-muted">Profil wird geladen …</p>
        )}
      </section>
      <section aria-labelledby="step2" className="rounded-[20px] border border-border p-4">
        <h3 id="step2" className="mb-2 flex items-center gap-2 text-[16px]">
          <FileText className="size-5 text-accent-text" aria-hidden /> 2. Unterlagen auswählen <span className="font-normal text-muted">(optional)</span>
        </h3>
        {files.length ? (
          files.map((f) => (
            <Checkbox key={f.id} label={f.originalName} description={f.scanStatus === "NOT_SCANNED" ? "nicht virengeprüft" : undefined} checked={selected.includes(f.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))} />
          ))
        ) : (
          <p className="text-[14px] text-muted">
            Keine Dokumente hochgeladen.{" "}
            <Link href="/konto/lebenslauf#dokumente" className="font-semibold text-accent-text underline">
              PDF hochladen
            </Link>
          </p>
        )}
        <Field label="Nachricht an den Auftraggeber" optional className="mt-3">
          {(id) => <Textarea id={id} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Kurz vorstellen, Verfügbarkeit nennen …" />}
        </Field>
      </section>
      <section aria-labelledby="step3" className="space-y-3">
        <h3 id="step3" className="flex items-center gap-2 text-[16px]">
          <CheckCircle2 className="size-5 text-accent-text" aria-hidden /> 3. Absenden
        </h3>
        {error && <Notice tone="error">{error}</Notice>}
        <SlideToApply onConfirm={submit} />
        <Button
          variant="secondary"
          className="w-full"
          loading={buttonBusy}
          onClick={async () => {
            setButtonBusy(true);
            await submit();
            setButtonBusy(false);
          }}
        >
          Ohne Schieben bewerben
        </Button>
        <p className="text-center text-[13px] text-muted">Bewerben ist kostenlos. Du kannst die Bewerbung zurückziehen, solange keine Zusage vorliegt.</p>
      </section>
    </div>
  );
}
