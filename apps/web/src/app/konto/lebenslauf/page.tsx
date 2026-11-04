"use client";
import { PROFILE_VISIBILITY_FIELDS, QUALIFICATION_KIND_LABELS, VISIBILITY_LABELS, type ProfileVisibilityField, type QualificationKind, type Visibility } from "@myminijob/core";
import { Eye, FileDown, Plus, Printer, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { QualificationPicker } from "@/components/common/qualification-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";

interface Exp {
  title: string;
  organization: string;
  from?: string | null;
  to?: string | null;
  description: string;
}
interface Edu {
  title: string;
  institution: string;
  from?: string | null;
  to?: string | null;
  qualificationId?: string | null;
}
interface ResumeQ {
  id: string;
  status: "SELF_DECLARED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  qualification: { id: string; name: string; kind: QualificationKind };
  documentFile: { id: string; originalName: string } | null;
}
interface Data {
  profile: { username: string; city: string | null; postalCode: string | null; about: string | null; skills: string[]; languages: Array<{ name: string; level: string }>; availability: string | null; desiredHourlyCents: number | null; visibility: Record<ProfileVisibilityField, Visibility> };
  resume: { headline: string; summary: string; experience: Exp[]; education: Edu[]; qualifications: ResumeQ[] };
}

const VIS_LABELS: Record<ProfileVisibilityField, string> = { region: "Region", experience: "Berufserfahrung", education: "Ausbildung & Studium", qualifications: "Qualifikationen", languages: "Sprachen", availability: "Verfügbarkeit", desiredWage: "Wunschlohn", documents: "Dokumente" };
const STATUS: Record<ResumeQ["status"], { label: string; tone: "neutral" | "warning" | "success" | "error" }> = {
  SELF_DECLARED: { label: "Selbstangabe, nicht geprüft", tone: "neutral" },
  PENDING_REVIEW: { label: "Nachweis wird geprüft", tone: "warning" },
  VERIFIED: { label: "Nachweis geprüft", tone: "success" },
  REJECTED: { label: "Nachweis abgelehnt", tone: "error" },
};
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "MUTTERSPRACHE"];

export default function LebenslaufPage() {
  const [d, setD] = useState<Data | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [skill, setSkill] = useState("");
  const [preview, setPreview] = useState(false);
  const [wage, setWage] = useState("");
  const toast = useToast();

  const load = async () => {
    const r = await api<Data>("/me/profile");
    setD(r);
    setWage(r.profile.desiredHourlyCents ? (r.profile.desiredHourlyCents / 100).toFixed(2).replace(".", ",") : "");
    const f = await api<{ items: UploadedFile[] }>("/me/files");
    setFiles(f.items);
  };
  useEffect(() => {
    load().catch(() => toast("Profil konnte nicht geladen werden", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!d) return <Spinner label="Lade Lebenslauf …" />;

  const p = d.profile;
  const r = d.resume;
  const setP = (patch: Partial<Data["profile"]>) => setD({ ...d, profile: { ...p, ...patch } });
  const setR = (patch: Partial<Data["resume"]>) => setD({ ...d, resume: { ...r, ...patch } });

  const save = async () => {
    setSaving(true);
    setErrors({});
    const cents = wage.trim() ? Math.round(Number(wage.replace(",", ".")) * 100) : null;
    try {
      await api("/me/profile", { method: "PUT", body: { ...p, desiredHourlyCents: Number.isFinite(cents) ? cents : null, postalCode: p.postalCode || null } });
      await api("/me/resume", { method: "PUT", body: { headline: r.headline, summary: r.summary, experience: r.experience, education: r.education } });
      toast("Lebenslauf gespeichert");
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fields ?? {});
        toast(e.message, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Lebenslauf" description="Einmal ausfüllen, für jede Bewerbung wiederverwenden. Foto und Geburtsdatum sind nicht nötig.">
        <div className="no-print flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPreview(true)}>
            <Eye className="size-4" aria-hidden /> Vorschau
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            Speichern
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-[20px]">Über mich</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Benutzername" error={errors.username}>
              {(id) => <Input id={id} value={p.username} onChange={(e) => setP({ username: e.target.value })} />}
            </Field>
            <Field label="Kurzprofil (Überschrift)" optional>
              {(id) => <Input id={id} maxLength={160} value={r.headline} onChange={(e) => setR({ headline: e.target.value })} placeholder="z. B. Zuverlässige Studentin mit Gartenerfahrung" />}
            </Field>
            <Field label="Ort" optional>
              {(id) => <Input id={id} value={p.city ?? ""} onChange={(e) => setP({ city: e.target.value })} autoComplete="address-level2" />}
            </Field>
            <Field label="PLZ" optional error={errors.postalCode}>
              {(id) => <Input id={id} inputMode="numeric" maxLength={5} value={p.postalCode ?? ""} onChange={(e) => setP({ postalCode: e.target.value })} autoComplete="postal-code" />}
            </Field>
          </div>
          <Field label="Zusammenfassung" optional>
            {(id) => <Textarea id={id} maxLength={3000} value={r.summary} onChange={(e) => setR({ summary: e.target.value })} />}
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Kompetenzen</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <button key={s} onClick={() => setP({ skills: p.skills.filter((x) => x !== s) })} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-[14px]" aria-label={`${s} entfernen`}>
                  {s} <X className="size-3.5" aria-hidden />
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const s = skill.trim();
                if (s && !p.skills.includes(s) && p.skills.length < 30) setP({ skills: [...p.skills, s] });
                setSkill("");
              }}
            >
              <Input aria-label="Kompetenz hinzufügen" value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="z. B. Heckenschnitt, Excel, Englisch" maxLength={60} />
              <Button type="submit" variant="secondary" size="icon" aria-label="Kompetenz hinzufügen">
                <Plus className="size-5" />
              </Button>
            </form>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Verfügbarkeit" optional>
              {(id) => <Input id={id} maxLength={500} value={p.availability ?? ""} onChange={(e) => setP({ availability: e.target.value })} placeholder="z. B. Wochenende, ab sofort" />}
            </Field>
            <Field label="Gewünschter Stundenlohn (€)" optional hint="Standardmäßig nur für dich sichtbar.">
              {(id, db) => <Input id={id} aria-describedby={db} inputMode="decimal" value={wage} onChange={(e) => setWage(e.target.value)} placeholder="z. B. 15,00" />}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-[20px]">Qualifikationen</h2>
          <p className="text-[14px] text-muted">Aus dem einheitlichen Katalog (Ausbildungsberufe, Studienfächer, Meister, Zertifikate). Ohne Nachweis gelten sie als Selbstangabe.</p>
          <QualificationPicker
            onSelect={async (q) => {
              try {
                await api("/me/resume/qualifications", { body: { qualificationId: q.id } });
                await load();
                toast(`${q.name} hinzugefügt`);
              } catch (e) {
                toast(e instanceof ApiClientError ? e.message : "Fehler", "error");
              }
            }}
          />
          <ul className="space-y-2">
            {r.qualifications.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{q.qualification.name}</p>
                  <p className="text-[13px] text-muted">{QUALIFICATION_KIND_LABELS[q.qualification.kind]}</p>
                </div>
                <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                {q.status !== "VERIFIED" && (
                  <FileUpload
                    purpose="QUALIFICATION_PROOF"
                    accept="application/pdf,image/png,image/jpeg"
                    label={q.documentFile ? "Neuer Nachweis" : "Nachweis"}
                    onUploaded={async (f) => {
                      await api("/me/resume/qualifications", { body: { qualificationId: q.qualification.id, documentFileId: f.id } });
                      await load();
                    }}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${q.qualification.name} entfernen`}
                  onClick={async () => {
                    await api(`/me/resume/qualifications/${q.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px]">Berufserfahrung</h2>
            <Button variant="secondary" size="sm" onClick={() => setR({ experience: [...r.experience, { title: "", organization: "", from: null, to: null, description: "" }] })}>
              <Plus className="size-4" aria-hidden /> Station
            </Button>
          </div>
          {r.experience.length === 0 && <p className="text-[14px] text-muted">Auch Nebenjobs, Ehrenamt oder private Hilfe zählen.</p>}
          {r.experience.map((x, i) => (
            <fieldset key={i} className="grid gap-3 rounded-[14px] border border-border p-4 sm:grid-cols-2">
              <legend className="sr-only">Station {i + 1}</legend>
              <Field label="Tätigkeit" error={errors[`experience.${i}.title`]}>
                {(id) => <Input id={id} value={x.title} onChange={(e) => setR({ experience: r.experience.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} />}
              </Field>
              <Field label="Bei" optional>
                {(id) => <Input id={id} value={x.organization} onChange={(e) => setR({ experience: r.experience.map((y, j) => (j === i ? { ...y, organization: e.target.value } : y)) })} />}
              </Field>
              <Field label="Von (JJJJ-MM)" optional>
                {(id) => <Input id={id} placeholder="2024-04" value={x.from ?? ""} onChange={(e) => setR({ experience: r.experience.map((y, j) => (j === i ? { ...y, from: e.target.value || null } : y)) })} />}
              </Field>
              <Field label="Bis (JJJJ-MM)" optional hint="leer = aktuell">
                {(id) => <Input id={id} placeholder="2025-10" value={x.to ?? ""} onChange={(e) => setR({ experience: r.experience.map((y, j) => (j === i ? { ...y, to: e.target.value || null } : y)) })} />}
              </Field>
              <Field label="Beschreibung" optional className="sm:col-span-2">
                {(id) => <Textarea id={id} value={x.description} onChange={(e) => setR({ experience: r.experience.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)) })} />}
              </Field>
              <Button variant="ghost" size="sm" className="justify-self-start text-error-text" onClick={() => setR({ experience: r.experience.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" aria-hidden /> Entfernen
              </Button>
            </fieldset>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px]">Ausbildung & Studium</h2>
          </div>
          <QualificationPicker label="Abschluss aus dem Katalog hinzufügen" kinds={["AUSBILDUNGSBERUF", "STUDIENFACH", "MEISTER_FORTBILDUNG"]} onSelect={(q) => setR({ education: [...r.education, { title: q.name, institution: "", from: null, to: null, qualificationId: q.id }] })} />
          <Button variant="link" onClick={() => setR({ education: [...r.education, { title: "", institution: "", from: null, to: null, qualificationId: null }] })}>
            Eintrag als Freitext hinzufügen (z. B. Schulabschluss)
          </Button>
          {r.education.map((x, i) => (
            <fieldset key={i} className="grid gap-3 rounded-[14px] border border-border p-4 sm:grid-cols-2">
              <legend className="sr-only">Ausbildung {i + 1}</legend>
              <Field label="Abschluss / Fach" hint={x.qualificationId ? "Aus dem Katalog – Selbstangabe" : "Freitext"}>
                {(id, db) => <Input id={id} aria-describedby={db} readOnly={!!x.qualificationId} value={x.title} onChange={(e) => setR({ education: r.education.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} />}
              </Field>
              <Field label="Schule / Hochschule / Betrieb" optional>
                {(id) => <Input id={id} value={x.institution} onChange={(e) => setR({ education: r.education.map((y, j) => (j === i ? { ...y, institution: e.target.value } : y)) })} />}
              </Field>
              <Field label="Von (JJJJ-MM)" optional>
                {(id) => <Input id={id} value={x.from ?? ""} onChange={(e) => setR({ education: r.education.map((y, j) => (j === i ? { ...y, from: e.target.value || null } : y)) })} />}
              </Field>
              <Field label="Bis (JJJJ-MM)" optional>
                {(id) => <Input id={id} value={x.to ?? ""} onChange={(e) => setR({ education: r.education.map((y, j) => (j === i ? { ...y, to: e.target.value || null } : y)) })} />}
              </Field>
              <Button variant="ghost" size="sm" className="justify-self-start text-error-text" onClick={() => setR({ education: r.education.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" aria-hidden /> Entfernen
              </Button>
            </fieldset>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px]">Sprachen</h2>
            <Button variant="secondary" size="sm" onClick={() => setP({ languages: [...p.languages, { name: "", level: "B1" }] })}>
              <Plus className="size-4" aria-hidden /> Sprache
            </Button>
          </div>
          {p.languages.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label="Sprache" className="flex-1">
                {(id) => <Input id={id} value={l.name} onChange={(e) => setP({ languages: p.languages.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} />}
              </Field>
              <Field label="Niveau" className="w-40">
                {(id) => (
                  <Select id={id} value={l.level} onChange={(e) => setP({ languages: p.languages.map((y, j) => (j === i ? { ...y, level: e.target.value } : y)) })}>
                    {LEVELS.map((x) => (
                      <option key={x} value={x}>
                        {x === "MUTTERSPRACHE" ? "Muttersprache" : x}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button variant="ghost" size="icon" aria-label="Sprache entfernen" onClick={() => setP({ languages: p.languages.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card id="dokumente">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px]">Dokumente</h2>
            <FileUpload purpose="RESUME_DOC" onUploaded={(f) => setFiles([f, ...files])} />
          </div>
          <p className="text-[14px] text-muted">PDF bis 5 MB. Dokumente sind privat und nur für Auftraggeber sichtbar, denen du sie bei einer Bewerbung ausdrücklich mitschickst.</p>
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-[14px] border border-border p-3">
                <FileDown className="size-5 text-muted" aria-hidden />
                <a href={`/api/v1/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {f.originalName}
                </a>
                {f.scanStatus === "NOT_SCANNED" && <Badge tone="warning">nicht virengeprüft</Badge>}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${f.originalName} löschen`}
                  onClick={async () => {
                    await api(`/files/${f.id}`, { method: "DELETE" });
                    setFiles(files.filter((x) => x.id !== f.id));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-[20px]">Sichtbarkeit</h2>
          <p className="text-[14px] text-muted">„Nur bei Bewerbungen“: Nur Auftraggeber, bei denen du dich bewirbst, sehen die Angabe.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROFILE_VISIBILITY_FIELDS.map((f) => (
              <Field key={f} label={VIS_LABELS[f]}>
                {(id) => (
                  <Select id={id} value={p.visibility[f]} onChange={(e) => setP({ visibility: { ...p.visibility, [f]: e.target.value as Visibility } })}>
                    {(["PUBLIC", "APPLICATIONS", "PRIVATE"] as Visibility[]).map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="no-print flex justify-end">
        <Button onClick={save} loading={saving} size="lg">
          Lebenslauf speichern
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview} title="Vorschau Lebenslauf" description="So sehen Auftraggeber deine Angaben bei einer Bewerbung (ohne „Nur ich“-Felder).">
        <ResumePreview d={d} />
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Drucken / als PDF
          </Button>
        </div>
      </Dialog>
      <Notice tone="info" className="no-print">
        Export: Über „Vorschau › Drucken / als PDF“ erhältst du deinen Lebenslauf als PDF. Alle deine Daten als Datei findest du unter Einstellungen › Datenexport.
      </Notice>
    </div>
  );
}

function ResumePreview({ d }: { d: Data }) {
  const v = d.profile.visibility;
  const show = (f: ProfileVisibilityField) => v[f] !== "PRIVATE";
  return (
    <div className="space-y-4 text-[15px]">
      <div>
        <p className="text-[20px] font-bold">{d.profile.username}</p>
        {d.resume.headline && <p className="text-muted">{d.resume.headline}</p>}
        {show("region") && d.profile.city && <p className="text-muted">{d.profile.city}</p>}
      </div>
      {d.resume.summary && <p>{d.resume.summary}</p>}
      {d.profile.skills.length > 0 && <p>Kompetenzen: {d.profile.skills.join(", ")}</p>}
      {show("experience") && d.resume.experience.length > 0 && (
        <div>
          <p className="font-semibold">Erfahrung</p>
          {d.resume.experience.map((x, i) => (
            <p key={i}>
              {x.title}
              {x.organization && ` · ${x.organization}`} {x.from && `(${x.from} – ${x.to ?? "heute"})`}
            </p>
          ))}
        </div>
      )}
      {show("education") && d.resume.education.length > 0 && (
        <div>
          <p className="font-semibold">Ausbildung & Studium</p>
          {d.resume.education.map((x, i) => (
            <p key={i}>
              {x.title}
              {x.institution && ` · ${x.institution}`}
            </p>
          ))}
        </div>
      )}
      {show("qualifications") && d.resume.qualifications.length > 0 && (
        <div>
          <p className="font-semibold">Qualifikationen</p>
          {d.resume.qualifications.map((q) => (
            <p key={q.id}>
              {q.qualification.name} <span className="text-muted">({STATUS[q.status].label})</span>
            </p>
          ))}
        </div>
      )}
      {show("languages") && d.profile.languages.length > 0 && <p>Sprachen: {d.profile.languages.map((l) => `${l.name} (${l.level === "MUTTERSPRACHE" ? "Muttersprache" : l.level})`).join(", ")}</p>}
      {show("availability") && d.profile.availability && <p>Verfügbarkeit: {d.profile.availability}</p>}
    </div>
  );
}
