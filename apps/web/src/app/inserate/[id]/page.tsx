import { CATEGORY_LABELS, EMPLOYMENT_LABELS, PAYMENT_METHOD_LABELS, QUALIFICATION_KIND_LABELS, REQUIREMENT_LABELS } from "@myminijob/core";
import { BadgeCheck, CalendarDays, Clock, CreditCard, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/common/report-button";
import { ApplyPanel } from "@/components/listing/apply-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { date, perHour } from "@/lib/format";
import { currentUser } from "@/server/current-user";
import { ApiError } from "@/server/errors";
import { getListing } from "@/server/services/listings";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return await getListing(id, await currentUser());
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/inserate/[id]">): Promise<Metadata> {
  const l = await load((await params).id);
  return { title: l.title, description: l.description.slice(0, 150) };
}

export default async function ListingPage({ params }: PageProps<"/inserate/[id]">) {
  const l = await load((await params).id);
  const open = l.status === "PUBLISHED" && l.openPositions > 0;
  const required = l.requirements.filter((r) => r.level === "REQUIRED");
  const preferred = l.requirements.filter((r) => r.level === "PREFERRED");
  const reqLabel = (r: (typeof l.requirements)[number]) => r.qualification?.name ?? r.text ?? "";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <article className="space-y-6">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="accent">{CATEGORY_LABELS[l.category]}</Badge>
            <Badge>{EMPLOYMENT_LABELS[l.employmentType]}</Badge>
            {l.isDemo && <Badge tone="warning">Demo-Inserat</Badge>}
            {l.status !== "PUBLISHED" && <Badge tone="warning">{{ DRAFT: "Entwurf", PAUSED: "Pausiert", CLOSED: "Geschlossen", ARCHIVED: "Archiviert", PUBLISHED: "" }[l.status]}</Badge>}
          </div>
          <h1>{l.title}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {l.posterType === "BUSINESS" && l.business ? (
              <span className="inline-flex items-center gap-1">
                {l.business.name}
                {l.business.verificationStatus === "VERIFIED" ? (
                  <span className="inline-flex items-center gap-1 text-accent-text">
                    <BadgeCheck className="size-4" aria-hidden /> verifiziert
                  </span>
                ) : (
                  <span>(nicht verifiziert)</span>
                )}
              </span>
            ) : (
              <>
                Privat ·{" "}
                {l.ownerUsername && (
                  <Link className="underline" href={`/profil/${encodeURIComponent(l.ownerUsername)}`}>
                    {l.ownerUsername}
                  </Link>
                )}
              </>
            )}
            {l.publishedAt && <> · veröffentlicht am {date(l.publishedAt)}</>}
          </p>
        </div>
        {l.isOwner && (
          <Notice tone="info" title="Das ist dein Inserat">
            <Link className="font-semibold underline" href={`/konto/inserate/${l.id}`}>
              Bewerbungen verwalten
            </Link>{" "}
            ·{" "}
            <Link className="font-semibold underline" href={`/konto/inserate/${l.id}/bearbeiten`}>
              Bearbeiten
            </Link>
          </Notice>
        )}
        {l.warnings.map((w) => (
          <Notice key={w} tone="warning">
            {w}
          </Notice>
        ))}
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Fact icon={CreditCard} label="Verbindlicher Stundenlohn" value={perHour(l.hourlyWageCents)} strong />
            <Fact icon={MapPin} label="Ort" value={l.remote ? `Remote${l.city ? ` (Bezug: ${l.city})` : ""}` : [l.postalCode, l.city].filter(Boolean).join(" ")} />
            <Fact icon={Clock} label="Umfang" value={[l.hoursPerWeek && `${l.hoursPerWeek.toLocaleString("de-DE")} Std./Woche`, l.hoursTotal && `${l.hoursTotal.toLocaleString("de-DE")} Std. gesamt`].filter(Boolean).join(" · ") || "–"} />
            <Fact icon={CalendarDays} label="Zeitraum" value={l.startDate ? `${date(l.startDate)}${l.endDate ? ` – ${date(l.endDate)}` : ""}` : "nach Absprache"} />
            <Fact icon={Users} label="Freie Plätze" value={`${l.openPositions} von ${l.positions}`} />
            <Fact icon={CreditCard} label="Zahlung der Vergütung" value={`${PAYMENT_METHOD_LABELS[l.paymentMethod]} – direkt durch den Auftraggeber`} />
          </CardBody>
        </Card>
        <section>
          <h2 className="mb-3">Beschreibung</h2>
          <p className="whitespace-pre-line text-[16px] leading-7">{l.description}</p>
          {l.scheduleText && <p className="mt-3 text-[15px] text-muted">Arbeitszeiten: {l.scheduleText}</p>}
          {(l.weekend || l.evening) && <p className="mt-1 text-[15px] text-muted">{[l.weekend && "am Wochenende", l.evening && "abends"].filter(Boolean).join(", ")}</p>}
          {l.compensationNotes && <p className="mt-3 text-[15px]">Zur Vergütung: {l.compensationNotes}</p>}
          {l.paymentNotes && <p className="mt-1 text-[15px]">Zahlungsmodalitäten: {l.paymentNotes}</p>}
        </section>
        {l.requirements.length > 0 && (
          <section>
            <h2 className="mb-3">Anforderungen</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Erforderlich", required],
                ["Wünschenswert", preferred],
              ].map(([title, list]) =>
                (list as typeof required).length ? (
                  <div key={title as string}>
                    <h3 className="mb-2 text-[15px] text-muted">{title as string}</h3>
                    <ul className="space-y-2">
                      {(list as typeof required).map((r) => (
                        <li key={r.id} className="rounded-[14px] border border-border px-3 py-2 text-[15px]">
                          <span className="font-medium">{reqLabel(r)}</span>
                          <span className="block text-[13px] text-muted">
                            {REQUIREMENT_LABELS[r.type]}
                            {r.qualification ? ` · ${QUALIFICATION_KIND_LABELS[r.qualification.kind]}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}
        {l.business?.description && (
          <section>
            <h2 className="mb-2">Über {l.business.name}</h2>
            <p className="text-[15px] text-muted">{l.business.description}</p>
          </section>
        )}
        <div className="flex flex-wrap gap-3">
          <ReportButton targetType="LISTING" targetId={l.id} />
          <Button asChild variant="ghost" size="sm">
            <Link href="/hilfe#sicherheit">Sicherheitstipps</Link>
          </Button>
        </div>
      </article>
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardBody>
            <h2 className="mb-4 text-[20px]">Bewerben</h2>
            {l.isOwner ? <p className="text-[15px] text-muted">Auf eigene Inserate kann man sich nicht bewerben.</p> : <ApplyPanel listingId={l.id} existing={l.myApplication} open={open} />}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function Fact({ icon: Icon, label, value, strong }: { icon: typeof Clock; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
      <div>
        <p className="text-[13px] text-muted">{label}</p>
        <p className={strong ? "text-[18px] font-bold" : "text-[15px] font-medium"}>{value}</p>
      </div>
    </div>
  );
}
