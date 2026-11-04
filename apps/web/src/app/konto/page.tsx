"use client";
import { ROLE_LABELS, SWITCHABLE_ROLES, type RoleType } from "@myminijob/core";
import { Bell, Building2, ChevronRight, FileText, Handshake, Inbox, LogOut, Megaphone, MessageCircle, Receipt, Settings } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VerifyBanner } from "@/components/account/verify-banner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";

interface Notification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const SECTIONS: Record<string, { href: string; label: string; desc: string; icon: typeof FileText; roles: RoleType[] }> = {
  resume: { href: "/konto/lebenslauf", label: "Lebenslauf", desc: "Einmal ausfüllen, immer wieder verwenden", icon: FileText, roles: ["APPLICANT"] },
  applications: { href: "/konto/bewerbungen", label: "Bewerbungen", desc: "Status deiner Bewerbungen", icon: Inbox, roles: ["APPLICANT"] },
  offers: { href: "/konto/angebote", label: "Angenommene Angebote", desc: "Zusagen bestätigen, Abschluss & Bewertung", icon: Handshake, roles: ["APPLICANT"] },
  listings: { href: "/konto/inserate", label: "Eigene Inserate", desc: "Erstellen, veröffentlichen, Bewerbungen prüfen", icon: Megaphone, roles: ["PRIVATE_POSTER", "BUSINESS_POSTER"] },
  messages: { href: "/konto/nachrichten", label: "Nachrichten", desc: "Chat mit Bewerbern und Auftraggebern", icon: MessageCircle, roles: ["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER"] },
  invoices: { href: "/konto/rechnungen", label: "Rechnungen", desc: "Vermittlungsgebühren (1,00 € pro Person)", icon: Receipt, roles: ["PRIVATE_POSTER", "BUSINESS_POSTER"] },
  business: { href: "/konto/unternehmen", label: "Unternehmensprofil", desc: "Für gewerbliche Inserate & Verifizierung", icon: Building2, roles: ["BUSINESS_POSTER"] },
  settings: { href: "/konto/einstellungen", label: "Einstellungen", desc: "Benachrichtigungen, Datenschutz, Darstellung", icon: Settings, roles: ["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER"] },
};

export default function KontoPage() {
  const { me, setMe } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [notes, setNotes] = useState<{ items: Notification[]; unread: number } | null>(null);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    setWelcome(new URLSearchParams(location.search).has("willkommen"));
    api<{ items: Notification[]; unread: number }>("/me/notifications").then(setNotes).catch(() => {});
  }, []);
  if (!me) return null;
  const role = me.activeRole === "ADMIN" ? "APPLICANT" : me.activeRole;
  const switchRole = async (r: RoleType) => {
    if (r === role) return;
    setMe({ ...me, activeRole: r });
    try {
      await api("/me/role", { method: "PATCH", body: { role: r } });
    } catch {
      setMe(me);
      toast("Rollenwechsel fehlgeschlagen", "error");
    }
  };
  const ordered = Object.values(SECTIONS).sort((a, b) => Number(b.roles.includes(role)) - Number(a.roles.includes(role)));
  const primary = ordered.filter((s) => s.roles.includes(role));
  const other = ordered.filter((s) => !s.roles.includes(role));
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[15px] text-muted">Hallo,</p>
        <h1>{me.username}</h1>
      </div>
      {welcome && <Notice tone="success" title="Willkommen bei My Minijob!">Wir haben dir einen Bestätigungslink per E-Mail geschickt.</Notice>}
      <VerifyBanner />
      <section aria-labelledby="role-title">
        <h2 id="role-title" className="mb-3 text-[17px]">Ich bin gerade …</h2>
        <div role="radiogroup" aria-labelledby="role-title" className="relative grid grid-cols-3 rounded-[18px] bg-surface-2 p-1">
          {SWITCHABLE_ROLES.map((r) => (
            <button key={r} role="radio" aria-checked={role === r} onClick={() => switchRole(r)} className={cn("relative h-11 rounded-[14px] text-[15px] font-semibold transition-colors", role === r ? "text-text" : "text-muted hover:text-text")}>
              {role === r && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-[14px] bg-surface shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <span className="relative">{ROLE_LABELS[r]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {primary.map((s) => (
          <SectionLink key={s.href} s={s} badge={s.href === "/konto/nachrichten" ? undefined : undefined} />
        ))}
      </section>
      {notes && notes.items.length > 0 && (
        <section aria-labelledby="notes-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="notes-title" className="flex items-center gap-2 text-[17px]">
              <Bell className="size-5" aria-hidden /> Benachrichtigungen {notes.unread > 0 && <span className="rounded-full bg-accent-hover px-2 text-[13px] text-white">{notes.unread}</span>}
            </h2>
            {notes.unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await api("/me/notifications", { body: {} });
                  setNotes({ ...notes, unread: 0, items: notes.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) });
                }}
              >
                Alle gelesen
              </Button>
            )}
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-surface">
            {notes.items.slice(0, 6).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/konto"} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent-hover")} aria-label={n.readAt ? undefined : "ungelesen"} />
                  <span className="min-w-0">
                    <span className="block font-medium">{n.title}</span>
                    <span className="block truncate text-[14px] text-muted">{n.body}</span>
                    <span className="text-[12px] text-muted">{relative(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Weitere Bereiche">
        <h2 className="mb-3 text-[17px] text-muted">Weitere Bereiche</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {other.map((s) => (
            <SectionLink key={s.href} s={s} subtle />
          ))}
          {me.isAdmin && <SectionLink s={{ href: "/admin", label: "Administration", desc: "Moderation, Streitfälle, Verifizierungen", icon: Settings, roles: [] }} subtle />}
        </div>
      </section>
      <Button
        variant="secondary"
        onClick={async () => {
          await api("/auth/logout", { method: "POST" });
          setMe(null);
          router.push("/");
          router.refresh();
        }}
      >
        <LogOut className="size-4" aria-hidden /> Abmelden
      </Button>
    </div>
  );
}

function SectionLink({ s, subtle, badge }: { s: (typeof SECTIONS)[string]; subtle?: boolean; badge?: number }) {
  const Icon = s.icon;
  return (
    <Link href={s.href} className={cn("group flex items-center gap-4 rounded-[20px] border border-border p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]", subtle ? "bg-surface/60" : "bg-surface")}>
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-accent/12 text-accent-text">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{s.label}</span>
        <span className="block text-[14px] text-muted">{s.desc}</span>
      </span>
      {badge ? <span className="rounded-full bg-accent-hover px-2 text-[13px] text-white">{badge}</span> : null}
      <ChevronRight className="size-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
