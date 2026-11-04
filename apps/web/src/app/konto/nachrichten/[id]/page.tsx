"use client";
import { Ban, Check, CheckCheck, Paperclip, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/account/page-header";
import { ReportButton } from "@/components/common/report-button";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError, newKey } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useConversationEvents } from "@/lib/realtime";
import { cn } from "@/lib/cn";

interface Msg {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  status: "sent" | "delivered" | "read" | null;
  attachment: { id: string; originalName: string } | null;
  pending?: boolean;
}
interface Data {
  conversation: { id: string; listing: { id: string; title: string }; counterpart: string; counterpartId: string; shareReadReceipts: boolean; blocked: boolean; iBlocked: boolean };
  messages: Msg[];
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<UploadedFile | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const r = await api<Data>(`/conversations/${id}/messages`);
      setD(r);
      api(`/conversations/${id}/read`, { method: "POST" }).catch(() => {});
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Fehler");
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const mode = useConversationEvents(id, load);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [d?.messages.length]);

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!d) return <Spinner label="Lade …" />;
  const c = d.conversation;

  const send = async () => {
    const body = text.trim();
    if ((!body && !attachment) || sending) return;
    setSending(true);
    const clientId = newKey();
    const optimistic: Msg = { id: clientId, body, mine: true, createdAt: new Date().toISOString(), status: null, attachment: attachment ? { id: attachment.id, originalName: attachment.originalName } : null, pending: true };
    setD({ ...d, messages: [...d.messages, optimistic] });
    setText("");
    try {
      await api(`/conversations/${id}/messages`, { body: { body, attachmentFileId: attachment?.id ?? null }, headers: { "idempotency-key": clientId } });
      setAttachment(null);
      await load();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Nachricht nicht gesendet", "error");
      setText(body);
      setD((x) => (x ? { ...x, messages: x.messages.filter((m) => m.id !== clientId) } : x));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-220px)] flex-col">
      <PageHeader title={c.counterpart} back="/konto/nachrichten" backLabel="Nachrichten" description={c.listing.title}>
        <div className="flex items-center gap-1">
          <ReportButton targetType="USER" targetId={c.counterpartId} compact />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (c.iBlocked) await api(`/users/${c.counterpartId}/block`, { method: "DELETE" });
              else if (confirm(`${c.counterpart} blockieren? Ihr könnt euch dann keine Nachrichten mehr schreiben.`)) await api(`/users/${c.counterpartId}/block`, { method: "POST" });
              else return;
              load();
            }}
          >
            <Ban className="size-4" aria-hidden /> {c.iBlocked ? "Blockierung aufheben" : "Blockieren"}
          </Button>
        </div>
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          <Link href={`/inserate/${c.listing.id}`} className="underline">
            Zum Inserat
          </Link>{" "}
          · {mode === "ws" ? "Live verbunden" : "Aktualisiert automatisch"}
        </span>
        <label className="flex items-center gap-2">
          Lesebestätigungen
          <Switch
            label="Lesebestätigungen teilen"
            checked={c.shareReadReceipts}
            onChange={async (v) => {
              await api(`/conversations/${id}`, { method: "PATCH", body: { shareReadReceipts: v } });
              load();
            }}
          />
        </label>
      </div>
      <Notice tone="info" className="mb-4">
        Sicherheitstipp: Zahle nie Vorkasse und teile Bankdaten oder Ausweise erst, wenn du dein Gegenüber kennst.
      </Notice>
      <ol className="flex-1 space-y-2" aria-live="polite" aria-label="Nachrichtenverlauf">
        {d.messages.map((m) => (
          <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("group max-w-[80%] rounded-[18px] px-4 py-2 text-[15px]", m.mine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md border border-border bg-surface")}>
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachment && (
                <a href={`/api/v1/files/${m.attachment.id}`} className="mt-1 flex items-center gap-1 underline">
                  <Paperclip className="size-4" aria-hidden /> {m.attachment.originalName}
                </a>
              )}
              <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", m.mine ? "text-on-primary/70" : "text-muted")}>
                {dateTime(m.createdAt)}
                {m.mine && (m.pending ? <Spinner className="size-3" /> : m.status === "read" ? <CheckCheck className="size-3.5" aria-label="gelesen" /> : m.status === "delivered" ? <CheckCheck className="size-3.5 opacity-60" aria-label="zugestellt" /> : <Check className="size-3.5" aria-label="gesendet" />)}
              </p>
              {!m.mine && (
                <div className="hidden group-hover:block">
                  <ReportButton targetType="MESSAGE" targetId={m.id} compact />
                </div>
              )}
            </div>
          </li>
        ))}
        <div ref={bottom} />
      </ol>
      {c.blocked ? (
        <Notice tone="warning" className="mt-4">Diese Unterhaltung ist blockiert.</Notice>
      ) : (
        <form
          className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] mt-4 flex items-end gap-2 rounded-[20px] border border-border bg-surface p-2 shadow-[var(--shadow-card)] lg:bottom-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <FileUpload purpose="CHAT_ATTACHMENT" accept="application/pdf,image/png,image/jpeg,image/webp" label="" onUploaded={setAttachment} />
          <div className="min-w-0 flex-1">
            {attachment && (
              <p className="px-2 pb-1 text-[13px] text-muted">
                📎 {attachment.originalName}{" "}
                <button type="button" className="underline" onClick={() => setAttachment(null)}>
                  entfernen
                </button>
              </p>
            )}
            <label htmlFor="msg" className="sr-only">
              Nachricht
            </label>
            <textarea
              id="msg"
              rows={1}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Nachricht schreiben …"
              className="max-h-40 min-h-11 w-full resize-none bg-transparent px-2 py-2.5 text-[16px] outline-none"
            />
          </div>
          <Button type="submit" size="icon" aria-label="Senden" disabled={sending || (!text.trim() && !attachment)}>
            <Send className="size-5" />
          </Button>
        </form>
      )}
    </div>
  );
}
