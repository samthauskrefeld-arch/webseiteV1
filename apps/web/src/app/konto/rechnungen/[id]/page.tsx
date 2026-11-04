"use client";
import { Download, FileCode } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError, newKey } from "@/lib/api";
import { date, euro } from "@/lib/format";
import { STATUS_LABEL, type InvoiceRow } from "@/lib/invoice";

interface Inv extends InvoiceRow {
  netCents: number;
  taxCents: number;
  taxRateBp: number;
  taxNote: string;
  serviceDate: string;
  recipient: { name?: string; street?: string | null; postalCode?: string | null; city?: string | null };
  corrects: { number: string } | null;
  payments: Array<{ id: string; status: string; amountCents: number; isTest: boolean; createdAt: string }>;
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<{ invoice: Inv; payment: { isTest: boolean } } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const toast = useToast();
  const load = () => api<{ invoice: Inv; payment: { isTest: boolean } }>(`/invoices/${id}`).then(setD);
  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!d) return <Spinner label="Lade …" />;
  const i = d.invoice;
  return (
    <div className="space-y-4">
      <PageHeader title={`${i.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"} ${i.number}`} back="/konto/rechnungen" backLabel="Rechnungen">
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <a href={`/api/v1/invoices/${i.id}/pdf`}>
              <Download className="size-4" aria-hidden /> PDF
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`/api/v1/invoices/${i.id}/xml`} title="E-Rechnung im UBL/XRechnung-Format (Entwurf)">
              <FileCode className="size-4" aria-hidden /> E-Rechnung
            </a>
          </Button>
        </div>
      </PageHeader>
      {i.isTest && <Notice tone="warning" title="Testmodus">Diese Rechnung stammt aus dem Testbetrieb. Es wird kein echtes Geld bewegt.</Notice>}
      <Card>
        <CardBody className="space-y-4 text-[15px]">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-muted">Empfänger</p>
              <p className="font-medium">{i.recipient.name}</p>
              {i.recipient.street && <p>{i.recipient.street}</p>}
              {(i.recipient.postalCode || i.recipient.city) && (
                <p>
                  {i.recipient.postalCode} {i.recipient.city}
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge tone={i.status === "OPEN" ? "warning" : "neutral"}>{STATUS_LABEL[i.status]}</Badge>
              <p className="mt-2 text-muted">Rechnungsdatum {date(i.issueDate)}</p>
              <p className="text-muted">Leistungsdatum {date(i.serviceDate)}</p>
              {i.kind === "INVOICE" && <p className="text-muted">Fällig {date(i.dueDate)}</p>}
              {i.corrects && <p className="text-muted">korrigiert {i.corrects.number}</p>}
            </div>
          </div>
          <div className="rounded-[14px] bg-surface-2 p-4">
            <p>{i.description}</p>
            <div className="mt-3 space-y-1 text-right">
              {i.taxRateBp > 0 && (
                <>
                  <p className="text-muted">Netto {euro(i.netCents)}</p>
                  <p className="text-muted">
                    USt. {i.taxRateBp / 100} % {euro(i.taxCents)}
                  </p>
                </>
              )}
              <p className="text-[18px] font-bold">Gesamt {euro(i.grossCents)}</p>
            </div>
          </div>
          <p className="text-[13px] text-muted">{i.taxNote}</p>
          {i.status === "OPEN" && i.kind === "INVOICE" && (
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/invoices/${i.id}/pay`, { method: "POST", headers: { "idempotency-key": key.current } });
                  toast(d.payment.isTest ? "Testzahlung erfolgreich" : "Zahlung erfolgreich");
                  await load();
                } catch (e) {
                  toast(e instanceof ApiClientError ? e.message : "Zahlung fehlgeschlagen", "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {d.payment.isTest ? "Testzahlung ausführen (kein echtes Geld)" : `Jetzt bezahlen (${euro(i.grossCents)})`}
            </Button>
          )}
          {i.payments.length > 0 && (
            <div>
              <p className="font-semibold">Zahlungen</p>
              <ul className="text-[14px] text-muted">
                {i.payments.map((p) => (
                  <li key={p.id}>
                    {date(p.createdAt)} · {euro(p.amountCents)} · {p.status}
                    {p.isTest ? " (Test)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
      <BillingAddress />
    </div>
  );
}

function BillingAddress() {
  const [a, setA] = useState({ name: "", street: "", postalCode: "", city: "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    api<{ address: typeof a | null }>("/me/billing-address").then((r) => r.address && setA({ name: r.address.name, street: r.address.street, postalCode: r.address.postalCode, city: r.address.city }));
  }, []);
  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 text-[18px]">Rechnungsadresse (Privat)</h2>
        <p className="mb-4 text-[14px] text-muted">Gilt für künftige Rechnungen privater Inserate. Gewerbliche Rechnungen nutzen das Unternehmensprofil. Bereits ausgestellte Rechnungen bleiben unverändert.</p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/me/billing-address", { method: "PUT", body: a });
              toast("Rechnungsadresse gespeichert");
            } catch (err) {
              toast(err instanceof ApiClientError ? err.message : "Fehler", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Name">{(id) => <Input id={id} autoComplete="name" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />}</Field>
          <Field label="Straße und Nr.">{(id) => <Input id={id} autoComplete="street-address" value={a.street} onChange={(e) => setA({ ...a, street: e.target.value })} />}</Field>
          <Field label="PLZ">{(id) => <Input id={id} autoComplete="postal-code" inputMode="numeric" maxLength={5} value={a.postalCode} onChange={(e) => setA({ ...a, postalCode: e.target.value })} />}</Field>
          <Field label="Ort">{(id) => <Input id={id} autoComplete="address-level2" value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} />}</Field>
          <Button type="submit" variant="secondary" loading={busy} className="sm:col-span-2 sm:justify-self-start">
            Speichern
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
