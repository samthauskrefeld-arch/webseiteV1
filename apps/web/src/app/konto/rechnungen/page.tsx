"use client";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { date, euro } from "@/lib/format";
import { STATUS_LABEL, type InvoiceRow } from "@/lib/invoice";

export default function Page() {
  const [d, setD] = useState<{ items: InvoiceRow[]; payment: { isTest: boolean } } | null>(null);
  useEffect(() => {
    api<{ items: InvoiceRow[]; payment: { isTest: boolean } }>("/me/invoices").then(setD).catch(() => setD({ items: [], payment: { isTest: true } }));
  }, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Rechnungen" description="Vermittlungsgebühren: 1,00 € pro bestätigter Vermittlung. Arbeitslöhne laufen nicht über My Minijob." />
      {d?.payment.isTest && <Notice tone="warning" title="Testmodus">Zahlungen laufen über einen Testadapter – es wird kein echtes Geld bewegt.</Notice>}
      {!d ? (
        <Spinner label="Lade …" />
      ) : !d.items.length ? (
        <Empty icon={<Receipt className="size-5" />} title="Keine Rechnungen">Rechnungen entstehen erst, wenn eine Vermittlung bestätigt wurde.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
          {d.items.map((i) => (
            <li key={i.id}>
              <Link href={`/konto/rechnungen/${i.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {i.kind === "CANCELLATION" ? "Storno " : ""}
                    {i.number}
                  </p>
                  <p className="truncate text-[14px] text-muted">{i.description}</p>
                  <p className="text-[13px] text-muted">{date(i.issueDate)}</p>
                </div>
                <span className="font-semibold">{euro(i.grossCents)}</span>
                <Badge tone={i.status === "OPEN" ? "warning" : "neutral"}>{STATUS_LABEL[i.status]}</Badge>
                {i.isTest && <Badge tone="warning">Test</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
