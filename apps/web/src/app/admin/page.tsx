"use client";
import { QUALIFICATION_KIND_LABELS, type QualificationKind } from "@myminijob/core";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { QualificationPicker, type QualificationHit } from "@/components/common/qualification-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";
import { date } from "@/lib/format";

interface Overview {
  reports: Array<{ id: string; targetType: string; targetId: string; reason: string; details: string; createdAt: string; reporter: { profile: { username: string } | null } }>;
  disputes: Array<{ id: string; reason: string; createdAt: string; mediationEvent: { id: string; listing: { title: string } } }>;
  businesses: Array<{ id: string; name: string; vatId: string | null; city: string | null; owner: { profile: { username: string } | null; files: Array<{ id: string; originalName: string }> } }>;
  proofs: Array<{ id: string; qualification: { name: string }; documentFile: { id: string; originalName: string } | null; resume: { user: { profile: { username: string } | null } } }>;
  catalog: { imports: Array<{ id: string; version: string; source: string; license: string; recordCount: number; importedAt: string }>; counts: Array<{ kind: QualificationKind; count: number }> };
}

export default function AdminPage() {
  const [d, setD] = useState<Overview | null>(null);
  const toast = useToast();
  const load = () => api<Overview>("/admin/overview").then(setD);
  useEffect(() => {
    load().catch(() => {});
  }, []);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      await load();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Fehler", "error");
    }
  };
  const reason = (label: string) => prompt(`Begründung (${label}):`)?.trim();
  if (!d) return <Spinner label="Lade …" />;
  return (
    <div className="space-y-6">
      <PageHeader title="Administration" back={null} description="Jede Entscheidung wird im Audit-Log protokolliert. Betroffene werden mit Begründung informiert (DSA)." />
      <Card>
        <CardBody>
          <h2 className="mb-3 text-[20px]">Meldungen ({d.reports.length})</h2>
          {!d.reports.length && <p className="text-muted">Keine offenen Meldungen.</p>}
          <ul className="space-y-3">
            {d.reports.map((r) => (
              <li key={r.id} className="rounded-[14px] border border-border p-3 text-[15px]">
                <p>
                  <Badge>{r.targetType}</Badge> <span className="font-semibold">{r.reason}</span> · von {r.reporter.profile?.username} · {date(r.createdAt)}
                </p>
                {r.details && <p className="mt-1 text-muted">{r.details}</p>}
                <p className="mt-1 text-[13px] text-muted">
                  Ziel-ID: {r.targetId}
                  {r.targetType === "LISTING" && (
                    <>
                      {" "}
                      · <a className="underline" href={`/inserate/${r.targetId}`}>ansehen</a>
                    </>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { const x = reason("verwerfen"); if (x) act(() => api(`/admin/reports/${r.id}`, { body: { action: "dismiss", resolution: x } }), "Verworfen"); }}>Verwerfen</Button>
                  {r.targetType !== "USER" && <Button size="sm" onClick={() => { const x = reason("ausblenden"); if (x) act(() => api(`/admin/reports/${r.id}`, { body: { action: "hide", resolution: x } }), "Ausgeblendet"); }}>Ausblenden</Button>}
                  {r.targetType === "USER" && <Button size="sm" variant="danger" onClick={() => { const x = reason("sperren"); if (x) act(() => api(`/admin/reports/${r.id}`, { body: { action: "suspend_user", resolution: x } }), "Gesperrt"); }}>Konto sperren</Button>}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-3 text-[20px]">Streitfälle / Storno ({d.disputes.length})</h2>
          {!d.disputes.length && <p className="text-muted">Keine offenen Streitfälle.</p>}
          <ul className="space-y-3">
            {d.disputes.map((x) => (
              <li key={x.id} className="rounded-[14px] border border-border p-3 text-[15px]">
                <p className="font-semibold">{x.mediationEvent.listing.title}</p>
                <p className="text-muted">{x.reason}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => { const r = reason("Erstattung"); if (r) act(() => api(`/admin/disputes/${x.id}`, { body: { refund: true, resolution: r } }), "Storniert & erstattet"); }}>Stornieren & erstatten</Button>
                  <Button size="sm" variant="secondary" onClick={() => { const r = reason("Ablehnung"); if (r) act(() => api(`/admin/disputes/${x.id}`, { body: { refund: false, resolution: r } }), "Abgelehnt"); }}>Ablehnen</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-3 text-[20px]">Unternehmensverifizierung ({d.businesses.length})</h2>
          <ul className="space-y-3">
            {d.businesses.map((b) => (
              <li key={b.id} className="rounded-[14px] border border-border p-3 text-[15px]">
                <p className="font-semibold">{b.name}</p>
                <p className="text-muted">
                  {b.city} · USt-IdNr. {b.vatId ?? "–"} · Konto {b.owner.profile?.username}
                </p>
                {b.owner.files.map((f) => (
                  <a key={f.id} className="block text-accent-text underline" href={`/api/v1/files/${f.id}`}>
                    {f.originalName}
                  </a>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => act(() => api(`/admin/businesses/${b.id}`, { body: { approve: true } }), "Verifiziert")}>Verifizieren</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/businesses/${b.id}`, { body: { approve: false } }), "Abgelehnt")}>Ablehnen</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-3 text-[20px]">Qualifikationsnachweise ({d.proofs.length})</h2>
          <ul className="space-y-3">
            {d.proofs.map((p) => (
              <li key={p.id} className="rounded-[14px] border border-border p-3 text-[15px]">
                <p>
                  <span className="font-semibold">{p.qualification.name}</span> · {p.resume.user.profile?.username}
                </p>
                {p.documentFile && (
                  <a className="text-accent-text underline" href={`/api/v1/files/${p.documentFile.id}`}>
                    {p.documentFile.originalName}
                  </a>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => act(() => api(`/admin/resume-qualifications/${p.id}`, { body: { approve: true } }), "Als geprüft markiert")}>Nachweis bestätigen</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(() => api(`/admin/resume-qualifications/${p.id}`, { body: { approve: false } }), "Abgelehnt")}>Ablehnen</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <AliasCard />
      <Card>
        <CardBody>
          <h2 className="mb-3 text-[20px]">Katalog</h2>
          <p className="mb-2 text-[15px]">{d.catalog.counts.map((c) => `${QUALIFICATION_KIND_LABELS[c.kind]}: ${c.count}`).join(" · ")}</p>
          <ul className="text-[14px] text-muted">
            {d.catalog.imports.map((i) => (
              <li key={i.id}>
                {i.version} · {i.recordCount} Einträge · {date(i.importedAt)} · Quelle: {i.source} · Lizenz: {i.license}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function AliasCard() {
  const [q, setQ] = useState<QualificationHit | null>(null);
  const [alias, setAlias] = useState("");
  const [kind, setKind] = useState("SYNONYM");
  const toast = useToast();
  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-[20px]">Alias pflegen</h2>
        <p className="text-[14px] text-muted">Aliase sind reine Suchhilfen und verweisen immer auf einen bestehenden Katalogeintrag.</p>
        <QualificationPicker label="Katalogeintrag" onSelect={setQ} />
        {q && <p className="text-[15px]">Gewählt: <span className="font-semibold">{q.name}</span></p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label="Alias">{(id) => <Input id={id} value={alias} onChange={(e) => setAlias(e.target.value)} />}</Field>
          <Field label="Art">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="SYNONYM">Synonym</option>
                <option value="ABBREVIATION">Abkürzung</option>
                <option value="SPELLING">Schreibvariante</option>
                <option value="COLLOQUIAL">Umgangssprachlich</option>
              </Select>
            )}
          </Field>
          <Button
            disabled={!q || alias.trim().length < 2}
            onClick={async () => {
              try {
                await api("/admin/aliases", { body: { qualificationId: q!.id, alias, kind } });
                toast("Alias gespeichert");
                setAlias("");
              } catch (e) {
                toast(e instanceof ApiClientError ? e.message : "Fehler", "error");
              }
            }}
          >
            Speichern
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
