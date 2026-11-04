"use client";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";

interface Conv {
  id: string;
  listing: { id: string; title: string };
  counterpart: string;
  lastMessage: { preview: string; mine: boolean; at: string } | null;
  unread: number;
}
export default function Page() {
  const [items, setItems] = useState<Conv[] | null>(null);
  useEffect(() => {
    api<{ items: Conv[] }>("/me/conversations").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  return (
    <div>
      <PageHeader title="Nachrichten" description="Unterhaltungen entstehen automatisch mit jeder Bewerbung. E-Mail-Adressen bleiben privat." />
      {!items ? (
        <Spinner label="Lade …" />
      ) : !items.length ? (
        <Empty icon={<MessageCircle className="size-5" />} title="Noch keine Unterhaltungen" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/konto/nachrichten/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 font-semibold text-accent-text">{c.counterpart.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{c.counterpart}</span>
                    {c.lastMessage && <span className="shrink-0 text-[12px] text-muted">{relative(c.lastMessage.at)}</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{c.listing.title}</span>
                  <span className={`block truncate text-[14px] ${c.unread ? "font-semibold text-text" : "text-muted"}`}>{c.lastMessage ? `${c.lastMessage.mine ? "Du: " : ""}${c.lastMessage.preview}` : "Noch keine Nachrichten"}</span>
                </span>
                {c.unread > 0 && <span className="rounded-full bg-accent-hover px-2 text-[13px] font-semibold text-white" aria-label={`${c.unread} ungelesen`}>{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
