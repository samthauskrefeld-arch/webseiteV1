"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "./logo";

const KEY = "mmj_intro_seen_v1";

/** Optional first-visit intro. Skippable, shown once, respects reduced motion. */
export function Intro() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    try {
      const forced = new URLSearchParams(location.search).has("intro");
      if (forced || (!localStorage.getItem(KEY) && !navigator.webdriver)) setShow(true);
    } catch {
      /* storage blocked → no intro */
    }
  }, []);
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div role="dialog" aria-modal="true" aria-labelledby="intro-title" className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#14263D] px-8 text-center text-white" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 1.02 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <button onClick={close} className="absolute right-4 top-[calc(16px+env(safe-area-inset-top))] min-h-11 rounded-full px-4 text-[15px] font-medium text-white/80 hover:text-white">
            Überspringen
          </button>
          <motion.div initial={reduce ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <LogoMark className="size-20" />
          </motion.div>
          <motion.h1 id="intro-title" className="mt-6 text-[34px] font-bold tracking-tight" initial={reduce ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, duration: 0.5 }}>
            My Minijob
          </motion.h1>
          <motion.p className="mt-3 text-lg text-white/85" initial={reduce ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }}>
            Menschen verbinden. Möglichkeiten schaffen.
          </motion.p>
          <motion.p className="mt-1 text-[15px] text-[#7fe3d8]" initial={reduce ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.85, duration: 0.5 }}>
            Finde Hilfe. Finde Arbeit. Ganz einfach.
          </motion.p>
          <motion.div className="mt-10" initial={reduce ? false : { y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.3, duration: 0.5 }}>
            <Button variant="accent" size="lg" onClick={close} autoFocus>
              My Minijob entdecken
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
