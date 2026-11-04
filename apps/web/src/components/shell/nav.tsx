"use client";
import { Compass, LayoutGrid, ShieldCheck, UserRound } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

const TABS = [
  { href: "/", label: "Discover", icon: Compass, match: (p: string) => !p.startsWith("/konto") && !p.startsWith("/admin") },
  { href: "/konto", label: "Mein Konto", icon: UserRound, match: (p: string) => p.startsWith("/konto") },
];

/** Floating bottom navigation (mobile) with exactly two tabs and a gliding indicator. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="no-print fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden">
      <div className="relative grid w-full max-w-xs grid-cols-2 rounded-[24px] border border-border/70 bg-surface/85 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl">
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-12 items-center justify-center gap-2 rounded-[18px] text-[15px] font-semibold transition-colors duration-200", active ? "text-on-primary" : "text-muted hover:text-text")}>
              {active && <motion.span layoutId="nav-indicator" className="absolute inset-0 rounded-[18px] bg-primary" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <t.icon className="relative size-5" aria-hidden />
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Compact desktop sidebar. */
export function Sidebar() {
  const path = usePathname();
  const { me } = useSession();
  const items = [...TABS, ...(me?.isAdmin ? [{ href: "/admin", label: "Administration", icon: ShieldCheck, match: (p: string) => p.startsWith("/admin") }] : [])];
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-8 px-2" aria-label="My Minijob Startseite">
        <Logo />
      </Link>
      <nav aria-label="Hauptnavigation" className="relative flex flex-col gap-1">
        {items.map((t) => {
          const active = t.match(path);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-medium transition-colors", active ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
              {active && <motion.span layoutId="side-indicator" className="absolute inset-0 rounded-[14px] bg-surface-2" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <t.icon className="relative size-5" aria-hidden />
              <span className="relative">{t.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 px-2 text-[13px] text-muted">
        {me ? (
          <p>
            Angemeldet als <span className="font-semibold text-text">{me.username}</span>
          </p>
        ) : (
          <Link href="/anmelden" className="inline-flex items-center gap-2 font-semibold text-accent-text">
            <LayoutGrid className="size-4" aria-hidden /> Anmelden
          </Link>
        )}
        <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/rechtliches/impressum">Impressum</Link>
          <Link href="/rechtliches/datenschutz">Datenschutz</Link>
          <Link href="/rechtliches/agb">AGB</Link>
          <Link href="/hilfe">Hilfe</Link>
        </nav>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="no-print safe-top sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" aria-label="My Minijob Startseite">
          <Logo />
        </Link>
      </div>
    </header>
  );
}
