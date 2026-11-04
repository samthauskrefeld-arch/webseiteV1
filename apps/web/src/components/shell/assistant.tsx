"use client";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { perHour } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Msg {
  role: "user" | "assistant";
  content: string;
  listingIds?: string[];
  mode?: "ai" | "basic";
  notice?: string;
}
interface MiniListing {
  id: string;
  title: string;
  city: string | null;
  remote: boolean;
  hourlyWageCents: number;
}

function ListingMini({ id }: { id: string }) {
  const [l, setL] = useState<MiniListing | null>(null);
  useEffect(() => {
    api<MiniListing>(`/listings/${id}`).then(setL).catch(() => setL(null));
  }, [id]);
  if (!l) return null;
  return (
    <Link href={`/inserate/${l.id}`} className="block rounded-[14px] border border-border bg-surface px-3 py-2 text-[14px] hover:border-accent/50">
      <span className="font-semibold">{l.title}</span>
      <span className="block text-muted">
        {l.remote ? "Remote" : l.city} · {perHour(l.hourlyWageCents)}
      </span>
    </Link>
  );
}

/** Floating "My Minijob AI" bubble (bottom right, above the mobile nav). */
export function Assistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hallo! Ich bin My Minijob AI. Ich helfe dir bei der Suche, bei Bewerbungen, Inserattexten, Lebenslauf-Formulierungen und Fragen zu Gebühren." }]);
  const list = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, reduce]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ mode: "ai" | "basic"; text: string; listingIds: string[]; notice?: string }>("/ai/chat", {
        body: { messages: next.filter((m, i) => i > 0 || m.role === "user").slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })) },
      });
      setMsgs((m) => [...m, { role: "assistant", content: r.text, listingIds: r.listingIds, mode: r.mode, notice: r.notice }]);
    } catch (e) {
      const msg = e instanceof ApiClientError && e.code === "OFFLINE" ? "Du bist offline. Sobald die Verbindung wieder da ist, helfe ich gern weiter." : e instanceof ApiClientError ? e.message : "Der Assistent ist gerade nicht erreichbar.";
      setMsgs((m) => [...m, { role: "assistant", content: msg, mode: "basic" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print">
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            aria-label="My Minijob AI öffnen"
            className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-float)] transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
          >
            <Sparkles className="size-6" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="My Minijob AI"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] top-[calc(8px+env(safe-area-inset-top))] z-50 flex flex-col overflow-hidden rounded-[24px] border border-border bg-surface shadow-[var(--shadow-float)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px]"
          >
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent-text">
                <Bot className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">My Minijob AI</p>
                <p className="text-[12px] text-muted">Antworten zu Rechtsfragen sind allgemeine Infos, keine Rechtsberatung.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Assistent schließen">
                <X className="size-5" />
              </button>
            </header>
            <div ref={list} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] space-y-2 rounded-[18px] px-4 py-2.5 text-[15px] leading-6", m.role === "user" ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md bg-surface-2")}>
                    {m.notice && <p className="text-[12px] font-medium text-warning-text">{m.notice}</p>}
                    <p className="whitespace-pre-line">{m.content}</p>
                    {m.listingIds?.map((id) => <ListingMini key={id} id={id} />)}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-1 px-2" aria-label="Assistent schreibt">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <form
              className="flex items-end gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="ai-input" className="sr-only">
                Nachricht an den Assistenten
              </label>
              <textarea
                id="ai-input"
                ref={inputRef}
                rows={1}
                maxLength={2000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Frag mich etwas …"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[14px] border border-border bg-bg px-3 py-2.5 text-[16px] outline-none focus:border-focus"
              />
              <button type="submit" disabled={busy || !input.trim()} className="grid size-11 place-items-center rounded-[14px] bg-primary text-on-primary disabled:opacity-40" aria-label="Senden">
                <Send className="size-5" aria-hidden />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
