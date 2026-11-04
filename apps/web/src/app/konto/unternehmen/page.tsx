"use client";
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { FileUpload } from "@/components/common/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api";

interface Business {
  name: string;
  legalForm: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  vatId: string | null;
  website: string | null;
  description: string | null;
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
}
const EMPTY: Business = { name: "", legalForm: "", street: "", postalCode: "", city: "", vatId: "", website: "", description: "" };
const STATUS = { UNVERIFIED: ["nicht verifiziert", "neutral"], PENDING: ["Prüfung läuft", "warning"], VERIFIED: ["verifiziert", "success"], REJECTED: ["abgelehnt", "error"] } as const;

export default function Page() {
  const [b, setB] = useState<Business | null>(null);
  const [exists, setExists] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    api<{ business: Business | null }>("/me/business").then((r) => {
      setExists(!!r.business);
      setB(r.business ?? EMPTY);
    });
  }, []);
  if (!b) return <Spinner label="Lade …" />;
  const st = b.verificationStatus ? STATUS[b.verificationStatus] : null;
  const val = (k: keyof Business) => (b[k] as string | null) ?? "";
  return (
    <div className="space-y-6">
      <PageHeader title="Unternehmensprofil" description="Pflicht für gewerbliche Inserate. Die Angaben erscheinen in deinen Inseraten und auf Rechnungen.">
        {st && (
          <Badge tone={st[1]}>
            {b.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4" aria-hidden />} {st[0]}
          </Badge>
        )}
      </PageHeader>
      <Card>
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErrors({});
              try {
                const body = Object.fromEntries(Object.entries(b).filter(([k]) => k !== "verificationStatus").map(([k, v]) => [k, v === "" ? null : v]));
                const r = await api<{ business: Business }>("/me/business", { method: "PUT", body: { ...body, name: b.name } });
                setB(r.business);
                setExists(true);
                toast("Unternehmensprofil gespeichert");
              } catch (err) {
                if (err instanceof ApiClientError) setErrors(err.fields ?? {});
                toast(err instanceof ApiClientError ? err.message : "Fehler", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Firmenname" error={errors.name} className="sm:col-span-2">{(id) => <Input id={id} required value={val("name")} onChange={(e) => setB({ ...b, name: e.target.value })} />}</Field>
            <Field label="Rechtsform" optional>{(id) => <Input id={id} value={val("legalForm")} onChange={(e) => setB({ ...b, legalForm: e.target.value })} placeholder="z. B. GmbH, e. K., GbR" />}</Field>
            <Field label="USt-IdNr." optional error={errors.vatId}>{(id) => <Input id={id} value={val("vatId")} onChange={(e) => setB({ ...b, vatId: e.target.value })} placeholder="DE123456789" />}</Field>
            <Field label="Straße und Nr." optional>{(id) => <Input id={id} value={val("street")} onChange={(e) => setB({ ...b, street: e.target.value })} />}</Field>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Field label="PLZ" optional error={errors.postalCode}>{(id) => <Input id={id} inputMode="numeric" maxLength={5} value={val("postalCode")} onChange={(e) => setB({ ...b, postalCode: e.target.value })} />}</Field>
              <Field label="Ort" optional>{(id) => <Input id={id} value={val("city")} onChange={(e) => setB({ ...b, city: e.target.value })} />}</Field>
            </div>
            <Field label="Website" optional error={errors.website} className="sm:col-span-2">{(id) => <Input id={id} type="url" value={val("website")} onChange={(e) => setB({ ...b, website: e.target.value })} placeholder="https://" />}</Field>
            <Field label="Beschreibung" optional className="sm:col-span-2">{(id) => <Textarea id={id} maxLength={2000} value={val("description")} onChange={(e) => setB({ ...b, description: e.target.value })} />}</Field>
            <Button type="submit" loading={busy} className="sm:col-span-2 sm:justify-self-start">
              Speichern
            </Button>
          </form>
        </CardBody>
      </Card>
      {exists && b.verificationStatus !== "VERIFIED" && (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-[20px]">Verifizierung</h2>
            <p className="text-[15px] text-muted">Das Abzeichen „verifiziert“ vergeben wir nur nach Prüfung eines Nachweises (z. B. Handelsregisterauszug oder Gewerbeanmeldung, PDF). Bei Änderung von Name, Adresse oder USt-IdNr. muss neu geprüft werden.</p>
            {b.verificationStatus === "PENDING" ? (
              <Notice tone="info">Dein Nachweis wird geprüft.</Notice>
            ) : (
              <FileUpload
                purpose="BUSINESS_DOC"
                label="Nachweis hochladen & Prüfung beantragen"
                onUploaded={async (f) => {
                  const r = await api<{ business: Business }>("/me/business/verification", { body: { documentFileId: f.id } });
                  setB(r.business);
                }}
              />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
