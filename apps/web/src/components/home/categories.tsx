"use client";
import { Briefcase, BookOpen, ChefHat, Clock, Flower2, GraduationCap, Hammer, Home, Medal, ShoppingBasket, Sun, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

/** Home categories map to real search filters (category, employment type or qualification kind). */
const CATS = [
  { label: "Gartenarbeit", icon: Flower2, filters: { category: "GARTEN" } },
  { label: "Haushalt", icon: Home, filters: { category: "HAUSHALT" } },
  { label: "Einkaufen", icon: ShoppingBasket, filters: { category: "EINKAUF" } },
  { label: "Gastronomie", icon: ChefHat, filters: { category: "GASTRONOMIE" } },
  { label: "Büro", icon: Briefcase, filters: { category: "BUERO" } },
  { label: "Handwerk", icon: Hammer, filters: { category: "HANDWERK" } },
  { label: "Ausbildung", icon: GraduationCap, filters: { employmentTypes: ["AUSBILDUNG"] } },
  { label: "Studium", icon: BookOpen, filters: { qualificationKind: "STUDIENFACH" } },
  { label: "Meisterqualifikation", icon: Medal, filters: { qualificationKind: "MEISTER_FORTBILDUNG" } },
  { label: "Teilzeit", icon: Clock, filters: { employmentTypes: ["TEILZEIT"] } },
  { label: "Vollzeit", icon: Sun, filters: { employmentTypes: ["VOLLZEIT"] } },
  { label: "Einmalige Aufträge", icon: Zap, filters: { employmentTypes: ["EINMALIG"] } },
];

export function CategoryGrid() {
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CATS.map((c, i) => (
        <motion.li key={c.label} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: i * 0.03, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <Link href={`/suche?filters=${encodeURIComponent(JSON.stringify(c.filters))}&label=${encodeURIComponent(c.label)}`} className="group flex h-full min-h-24 flex-col justify-between rounded-[20px] border border-border bg-surface p-4 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-card)]">
            <span className="grid size-10 place-items-center rounded-[12px] bg-accent/12 text-accent-text transition-colors group-hover:bg-accent/20">
              <c.icon className="size-5" aria-hidden />
            </span>
            <span className="mt-3 text-[15px] font-semibold">{c.label}</span>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
