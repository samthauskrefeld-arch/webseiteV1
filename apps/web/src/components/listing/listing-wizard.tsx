"use client";
import {
  CATEGORY_LABELS,
  EMPLOYMENT_LABELS,
  EMPLOYMENT_TYPES,
  LISTING_CATEGORIES,
  minimumWageCentsAt,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PRIVATE_EMPLOYMENT_TYPES,
  QUALIFICATION_KIND_LABELS,
  REQUIREMENT_LABELS,
  type EmploymentType,
  type ListingCategory,
  type ListingInput,
  type PaymentMethod,
  type QualificationKind,
  type RequirementLevel,
  type RequirementType,
} from "@myminijob/core";
import { Building2, Check, ChevronLeft, ChevronRight, Home, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QualificationPicker, type QualificationHit } from "@/components/common/qualification-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { perHour } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";

type Req = { type: RequirementType; level: RequirementLevel; qualificationId?: string | null; text?: string | null; label: string; kind?: QualificationKind };
export interface WizardInitial extends Partial<Omit<ListingInput, "requirements">> {
  requirements?: Req[];
  status?: string;
}

const STEPS = ["Art", "Tätigkeit", "Ort & Zeit", "Vergütung", "Anforderungen", "Vorschau"] as const;
const FIELD_STEP: Record<string, number> = { posterType: 0, title: 1, description: 1, category: 1, employmentType: 1, city: 2, postalCode: 2, remote: 2, startDate: 2, endDate: 2, hoursPerWeek: 2, hoursTotal: 2, positions: 2, scheduleText: 2, hourlyWageCents: 3, compensationNotes: 3, paymentMethod: 3, paymentNotes: 3, requirements: 4 };
const KIND_TO_TYPE: Record<QualificationKind, RequirementType> = { AUSBILDUNGSBERUF: "AUSBILDUNG", BERUF: "ERFAHRUNG", STUDIENFACH: "STUDIUM", MEISTER_FORTBILDUNG: "MEISTER", ZERTIFIKAT: "ZERTIFIKAT" };

export function ListingWizard({ listingId, initial }: { listingId?: string; initial?: WizardInitial }) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { me } = useSession();
  const [step, setStep] = useState(listingId ? 1 : 0);
  const [dir, setDir] = useState(1);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [wage, setWage] = useState(initial?.hourlyWageCents ? (initial.hourlyWageCents / 100).toFixed(2).replace(".", ",") : "");
  const [textReq, setTextReq] = useState("");
  const [f, setF] = useState<WizardInitial & { posterType: "PRIVATE" | "BUSINESS" }>({
    posterType: me?.activeRole === "BUSINESS_POSTER" ? "BUSINESS" : "PRIVATE",
    title: "",
    description: "",
    category: "GARTEN",
    employmentType: "EINMALIG",
    remote: false,
    city: "",
    postalCode: "",
    startDate: null,
    endDate: null,
    hoursPerWeek: null,
    hoursTotal: null,
    scheduleText: "",
    weekend: false,
    evening: false,
    positions: 1,
    compensationNotes: "",
    paymentMethod: "BANK_TRANSFER",
    paymentNotes: "",
    requirements: [],
    ...initial,
    status: undefined,
  });
  useEffect(() => {
    api<{ business: unknown }>("/me/business").then((r) => setHasBusiness(!!r.business)).catch(() => setHasBusiness(false));
  }, []);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const wageCents = (() => {
    const n = Number(wage.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  })();
  const minWage = minimumWageCentsAt();
  const allowedTypes = f.posterType === "PRIVATE" ? PRIVATE_EMPLOYMENT_TYPES : [...EMPLOYMENT_TYPES];

  const payload = (): ListingInput => ({
    posterType: f.posterType,
    title: f.title ?? "",
    description: f.description ?? "",
    category: f.category as ListingCategory,
    employmentType: f.employmentType as EmploymentType,
    remote: !!f.remote,
    city: f.city || null,
    postalCode: f.postalCode || null,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    hoursPerWeek: f.hoursPerWeek || null,
    hoursTotal: f.hoursTotal || null,
    scheduleText: f.scheduleText || null,
    weekend: !!f.weekend,
    evening: !!f.evening,
    positions: f.positions ?? 1,
    hourlyWageCents: wageCents,
    compensationNotes: f.compensationNotes || null,
    paymentMethod: f.paymentMethod as PaymentMethod,
    paymentNotes: f.paymentNotes || null,
    requirements: (f.requirements ?? []).map(({ type, level, qualificationId, text }) => ({ type, level, qualificationId: qualificationId ?? null, text: text ?? null })),
  });

  const submit = async (publish: boolean) => {
    setBusy(publish ? "publish" : "draft");
    setErrors({});
    try {
      const res = listingId
        ? await api<{ listing: { id: string; status: string }; warnings: string[] }>(`/listings/${listingId}`, { method: "PUT", body: payload() })
        : await api<{ listing: { id: string; status: string }; warnings: string[] }>("/listings", { body: payload() });
      if (publish && res.listing.status === "DRAFT") await api(`/listings/${res.listing.id}/status`, { body: { action: "publish" } });
      res.warnings.forEach((w) => toast(w, "info"));
      toast(publish ? "Inserat veröffentlicht" : listingId ? "Änderungen gespeichert" : "Entwurf gespeichert");
      router.push(`/konto/inserate/${res.listing.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) {
        const fields = Object.fromEntries(Object.entries(e.fields ?? {}).map(([k, v]) => [k.split(".")[0]!, v]));
        setErrors(fields);
        const first = Object.keys(fields).map((k) => FIELD_STEP[k] ?? 5).sort((a, b) => a - b)[0];
        if (first !== undefined && first < 5) go(first);
        toast(e.message, "error");
      } else toast("Speichern fehlgeschlagen", "error");
    } finally {
      setBusy(null);
    }
  };

  const addQual = (q: QualificationHit) => {
    if (f.requirements?.some((r) => r.qualificationId === q.id)) return;
    set({ requirements: [...(f.requirements ?? []), { type: KIND_TO_TYPE[q.kind], level: "PREFERRED", qualificationId: q.id, label: q.name, kind: q.kind }] });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex gap-1.5" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" onClick={() => i < step && go(i)} disabled={i > step} className="w-full text-left disabled:cursor-default" aria-current={i === step ? "step" : undefined}>
              <span className={cn("block h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-accent-hover" : "bg-border")} />
              <span className={cn("mt-1.5 hidden text-[12px] sm:block", i === step ? "font-semibold text-text" : "text-muted")}>{s}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-2 text-[14px] text-muted sm:hidden">
        Schritt {step + 1} von {STEPS.length}: {STEPS[step]}
      </p>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} custom={dir} initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 32 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
            <Card>
              <CardBody className="space-y-5">
                {step === 0 && (
                  <>
                    <h2>Wer inseriert?</h2>
                    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Art des Inserats">
                      {[
                        { v: "PRIVATE" as const, icon: Home, t: "Privat", d: "Hilfe im Alltag: Garten, Haushalt, Umzug, Nachhilfe …" },
                        { v: "BUSINESS" as const, icon: Building2, t: "Gewerblich", d: "Unternehmen: Minijob, Teil-/Vollzeit, Ausbildung, Projekte" },
                      ].map((o) => (
                        <button key={o.v} type="button" role="radio" aria-checked={f.posterType === o.v} onClick={() => set({ posterType: o.v, employmentType: o.v === "PRIVATE" && !PRIVATE_EMPLOYMENT_TYPES.includes(f.employmentType as EmploymentType) ? "EINMALIG" : f.employmentType })} className={cn("rounded-[20px] border-2 p-5 text-left transition-[border-color,background] duration-200", f.posterType === o.v ? "border-primary bg-primary/5" : "border-border hover:border-muted")}>
                          <o.icon className="mb-3 size-7 text-accent-text" aria-hidden />
                          <span className="block text-[17px] font-semibold">{o.t}</span>
                          <span className="block text-[14px] text-muted">{o.d}</span>
                        </button>
                      ))}
                    </div>
                    {f.posterType === "BUSINESS" && hasBusiness === false && (
                      <Notice tone="warning" title="Unternehmensprofil fehlt">
                        Für gewerbliche Inserate bitte zuerst das{" "}
                        <Link href="/konto/unternehmen" className="font-semibold underline">
                          Unternehmensprofil
                        </Link>{" "}
                        anlegen.
                      </Notice>
                    )}
                    {errors.posterType && <Notice tone="error">{errors.posterType}</Notice>}
                  </>
                )}
                {step === 1 && (
                  <>
                    <h2>Tätigkeit</h2>
                    <Field label="Titel" error={errors.title}>
                      {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. Hecke schneiden in Krefeld-Bockum" />}
                    </Field>
                    <Field label="Beschreibung" error={errors.description} hint="Was ist zu tun? Was wird gestellt? Was sollte man mitbringen?">
                      {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.description} className="min-h-40" maxLength={8000} value={f.description} onChange={(e) => set({ description: e.target.value })} />}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Kategorie" error={errors.category}>
                        {(id) => (
                          <Select id={id} value={f.category} onChange={(e) => set({ category: e.target.value as ListingCategory })}>
                            {LISTING_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABELS[c]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label="Beschäftigungsart" error={errors.employmentType} hint={f.posterType === "PRIVATE" ? "Für Privat: einmalig, Minijob, befristet oder Projekt" : undefined}>
                        {(id, d) => (
                          <Select id={id} aria-describedby={d} value={f.employmentType} onChange={(e) => set({ employmentType: e.target.value as EmploymentType })}>
                            {allowedTypes.map((t) => (
                              <option key={t} value={t}>
                                {EMPLOYMENT_LABELS[t]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h2>Ort & Zeit</h2>
                    <Checkbox label="Remote / ortsunabhängig möglich" checked={!!f.remote} onChange={(e) => set({ remote: e.target.checked })} />
                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                      <Field label="Ort" optional={!!f.remote} error={errors.city}>
                        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.city} value={f.city ?? ""} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" />}
                      </Field>
                      <Field label="PLZ" optional error={errors.postalCode}>
                        {(id) => <Input id={id} inputMode="numeric" maxLength={5} value={f.postalCode ?? ""} onChange={(e) => set({ postalCode: e.target.value })} />}
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Beginn" optional error={errors.startDate}>
                        {(id) => <Input id={id} type="date" value={f.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || null })} />}
                      </Field>
                      <Field label="Ende" optional error={errors.endDate}>
                        {(id) => <Input id={id} type="date" value={f.endDate ?? ""} onChange={(e) => set({ endDate: e.target.value || null })} />}
                      </Field>
                      <Field label="Stunden pro Woche" optional error={errors.hoursPerWeek} hint="oder Gesamtstunden angeben">
                        {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0.5} max={60} step={0.5} value={f.hoursPerWeek ?? ""} onChange={(e) => set({ hoursPerWeek: e.target.value ? Number(e.target.value) : null })} />}
                      </Field>
                      <Field label="Stunden gesamt" optional>
                        {(id) => <Input id={id} type="number" min={0.5} max={2000} step={0.5} value={f.hoursTotal ?? ""} onChange={(e) => set({ hoursTotal: e.target.value ? Number(e.target.value) : null })} />}
                      </Field>
                    </div>
                    <Field label="Arbeitszeiten" optional>
                      {(id) => <Input id={id} maxLength={500} value={f.scheduleText ?? ""} onChange={(e) => set({ scheduleText: e.target.value })} placeholder="z. B. Sa 9–15 Uhr, flexibel nach Absprache" />}
                    </Field>
                    <div className="flex flex-wrap gap-x-6">
                      <Checkbox label="Am Wochenende" checked={!!f.weekend} onChange={(e) => set({ weekend: e.target.checked })} />
                      <Checkbox label="Abends" checked={!!f.evening} onChange={(e) => set({ evening: e.target.checked })} />
                    </div>
                    <Field label="Anzahl gesuchter Personen" error={errors.positions} className="max-w-48">
                      {(id) => <Input id={id} type="number" min={1} max={50} value={f.positions ?? 1} onChange={(e) => set({ positions: Math.max(1, Number(e.target.value) || 1) })} />}
                    </Field>
                  </>
                )}
                {step === 3 && (
                  <>
                    <h2>Vergütung</h2>
                    <Field label="Verbindlicher Stundenlohn (brutto, €)" error={errors.hourlyWageCents} hint="Pflichtangabe. Wird im Inserat deutlich angezeigt.">
                      {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.hourlyWageCents} inputMode="decimal" value={wage} onChange={(e) => setWage(e.target.value)} placeholder="z. B. 15,00" className="max-w-48 text-[18px] font-semibold" />}
                    </Field>
                    {wageCents > 0 && wageCents < minWage && !["AUSBILDUNG", "PRAKTIKUM"].includes(f.employmentType ?? "") && (
                      <Notice tone="warning" title="Unter dem gesetzlichen Mindestlohn">
                        Der Mindestlohn beträgt aktuell {perHour(minWage)}. Für Arbeitnehmer ist eine niedrigere Vergütung in der Regel unzulässig. Allgemeine Information, keine Rechtsberatung.
                      </Notice>
                    )}
                    <Field label="Weitere Vergütungsdetails" optional error={errors.compensationNotes}>
                      {(id) => <Textarea id={id} maxLength={1000} value={f.compensationNotes ?? ""} onChange={(e) => set({ compensationNotes: e.target.value })} placeholder="z. B. Fahrtkosten werden erstattet, Verpflegung" />}
                    </Field>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">Zahlungsweg für die Vergütung</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {PAYMENT_METHODS.map((m) => (
                          <label key={m} className={cn("flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] border px-3 text-center text-[14px] font-medium", f.paymentMethod === m ? "border-primary bg-primary text-on-primary" : "border-border hover:bg-surface-2")}>
                            <input type="radio" name="pm" className="sr-only" checked={f.paymentMethod === m} onChange={() => set({ paymentMethod: m })} />
                            {PAYMENT_METHOD_LABELS[m]}
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[13px] text-muted">Barzahlung ist keine Option. Die Vergütung zahlst du direkt – My Minijob zahlt keine Löhne aus.</p>
                    </fieldset>
                    <Field label="Überweisungsmodalitäten" optional error={errors.paymentNotes}>
                      {(id) => <Input id={id} maxLength={500} value={f.paymentNotes ?? ""} onChange={(e) => set({ paymentNotes: e.target.value })} placeholder="z. B. Überweisung innerhalb von 3 Tagen nach Abschluss" />}
                    </Field>
                  </>
                )}
                {step === 4 && (
                  <>
                    <h2>Anforderungen</h2>
                    <p className="text-[15px] text-muted">Optional. Du entscheidest frei, ob eine Qualifikation erforderlich oder nur wünschenswert ist – soweit keine gesetzlichen Voraussetzungen gelten.</p>
                    <QualificationPicker label="Ausbildung, Studium, Meister oder Zertifikat" onSelect={addQual} />
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = textReq.trim();
                        if (t.length < 2) return;
                        set({ requirements: [...(f.requirements ?? []), { type: "FAEHIGKEIT", level: "PREFERRED", text: t, label: t }] });
                        setTextReq("");
                      }}
                    >
                      <Field label="Erfahrung oder Fähigkeit (Freitext)" className="flex-1">
                        {(id) => <Input id={id} maxLength={200} value={textReq} onChange={(e) => setTextReq(e.target.value)} placeholder="z. B. Erfahrung mit Heckenscheren" />}
                      </Field>
                      <Button type="submit" variant="secondary" size="icon" aria-label="Anforderung hinzufügen">
                        <Plus className="size-5" />
                      </Button>
                    </form>
                    {errors.requirements && <Notice tone="error">{errors.requirements}</Notice>}
                    <ul className="space-y-2">
                      {(f.requirements ?? []).map((r, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border p-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{r.label}</p>
                            <p className="text-[13px] text-muted">{r.kind ? QUALIFICATION_KIND_LABELS[r.kind] : REQUIREMENT_LABELS[r.type]}</p>
                          </div>
                          {!r.qualificationId && (
                            <Select aria-label="Art" className="h-11 w-36" value={r.type} onChange={(e) => set({ requirements: f.requirements!.map((x, j) => (j === i ? { ...x, type: e.target.value as RequirementType } : x)) })}>
                              {(["ERFAHRUNG", "FAEHIGKEIT", "SPRACHE", "FUEHRERSCHEIN"] as RequirementType[]).map((t) => (
                                <option key={t} value={t}>
                                  {REQUIREMENT_LABELS[t]}
                                </option>
                              ))}
                            </Select>
                          )}
                          <Select aria-label="Gewichtung" className="h-11 w-40" value={r.level} onChange={(e) => set({ requirements: f.requirements!.map((x, j) => (j === i ? { ...x, level: e.target.value as RequirementLevel } : x)) })}>
                            <option value="REQUIRED">Erforderlich</option>
                            <option value="PREFERRED">Wünschenswert</option>
                          </Select>
                          <Button variant="ghost" size="icon" aria-label="Entfernen" onClick={() => set({ requirements: f.requirements!.filter((_, j) => j !== i) })}>
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {step === 5 && (
                  <>
                    <h2>Vorschau</h2>
                    <div className="rounded-[20px] border border-border p-5">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge tone="accent">{CATEGORY_LABELS[f.category as ListingCategory]}</Badge>
                        <Badge>{EMPLOYMENT_LABELS[f.employmentType as EmploymentType]}</Badge>
                        <Badge>{f.posterType === "PRIVATE" ? "Privat" : "Gewerblich"}</Badge>
                      </div>
                      <h3 className="text-[20px]">{f.title || "Ohne Titel"}</h3>
                      <p className="mt-1 text-[15px] text-muted">
                        {f.remote ? "Remote" : [f.postalCode, f.city].filter(Boolean).join(" ") || "Ort fehlt"} · {wageCents ? perHour(wageCents) : "Stundenlohn fehlt"} · {f.positions} Person(en)
                      </p>
                      <p className="mt-3 whitespace-pre-line text-[15px]">{f.description || "Keine Beschreibung"}</p>
                      {(f.requirements ?? []).length > 0 && (
                        <ul className="mt-3 space-y-1 text-[14px]">
                          {f.requirements!.map((r, i) => (
                            <li key={i}>
                              {r.level === "REQUIRED" ? "Erforderlich" : "Wünschenswert"}: {r.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Notice tone="info">
                      Inserieren ist kostenlos. Erst wenn du einer Person verbindlich zusagst und sie annimmt, entsteht eine Vermittlungsgebühr von 1,00 € pro Person. Die Vergütung zahlst du direkt an die Person.
                    </Notice>
                    {!me?.emailVerified && <Notice tone="warning">Zum Veröffentlichen musst du deine E-Mail-Adresse bestätigen. Speichern als Entwurf ist möglich.</Notice>}
                  </>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
          <ChevronLeft className="size-4" aria-hidden /> Zurück
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => go(step + 1)} disabled={step === 0 && f.posterType === "BUSINESS" && hasBusiness === false}>
            Weiter <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => submit(false)} loading={busy === "draft"} disabled={!!busy}>
              {listingId ? "Änderungen speichern" : "Als Entwurf speichern"}
            </Button>
            {(!listingId || initial?.status === "DRAFT") && (
              <Button onClick={() => submit(true)} loading={busy === "publish"} disabled={!!busy || !me?.emailVerified}>
                <Check className="size-4" aria-hidden /> Veröffentlichen
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
