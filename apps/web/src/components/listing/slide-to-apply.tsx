"use client";
import { Check, ChevronRight } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type State = "idle" | "sending" | "done";

/**
 * "Zum Bewerben schieben". Snaps at the end, calls onConfirm exactly once (guarded by state),
 * and shows the check mark only after onConfirm resolved (= server confirmed the save).
 * Not keyboard-operable by design – the parent renders an accessible button alternative.
 */
export function SlideToApply({ onConfirm, disabled, label = "Zum Bewerben schieben" }: { onConfirm: () => Promise<boolean>; disabled?: boolean; label?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const [state, setState] = useState<State>("idle");
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const fill = useTransform(x, (v) => `${Math.min(100, ((v + 56) / (max + 56 || 1)) * 100)}%`);
  const textOpacity = useTransform(x, [0, max * 0.6 || 1], [1, 0]);

  useLayoutEffect(() => {
    const update = () => setMax((track.current?.offsetWidth ?? 0) - 56 - 8);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const finish = async () => {
    if (state !== "idle") return;
    setState("sending");
    animate(x, max, { duration: reduce ? 0 : 0.18 });
    const ok = await onConfirm().catch(() => false);
    if (ok) setState("done");
    else {
      setState("idle");
      animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
    }
  };

  return (
    <div ref={track} aria-hidden="true" className={cn("relative h-16 w-full select-none overflow-hidden rounded-[20px] border border-border bg-surface-2", disabled && "opacity-50")}>
      <motion.div className="absolute inset-y-0 left-0 rounded-[20px] bg-accent/25" style={{ width: fill }} />
      <motion.span style={{ opacity: state === "idle" ? textOpacity : 0 }} className="pointer-events-none absolute inset-0 grid place-items-center pl-12 text-[15px] font-semibold text-text">
        {label}
      </motion.span>
      {state === "done" && <span className="absolute inset-0 grid place-items-center pr-14 text-[15px] font-semibold text-success-text">Bewerbung gesendet</span>}
      <motion.div
        drag={state === "idle" && !disabled ? "x" : false}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x, touchAction: "none" }}
        onDragEnd={() => {
          if (x.get() > max * 0.88) finish();
          else animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
        }}
        data-testid="slide-thumb"
        className={cn("absolute left-1 top-1 grid size-14 cursor-grab place-items-center rounded-[16px] shadow-md active:cursor-grabbing", state === "done" ? "bg-success text-white" : "bg-primary text-on-primary")}
      >
        {state === "sending" ? <Spinner className="size-5" /> : state === "done" ? <Check className="size-6" /> : <ChevronRight className="size-6" />}
      </motion.div>
    </div>
  );
}
