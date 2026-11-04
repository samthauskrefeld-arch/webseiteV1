import { cn } from "@/lib/cn";
const tones = {
  neutral: "bg-surface-2 text-text",
  accent: "bg-accent/15 text-accent-text",
  success: "bg-success/12 text-success-text",
  warning: "bg-warning/12 text-warning-text",
  error: "bg-error/12 text-error-text",
  primary: "bg-primary/10 text-primary",
} as const;
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5", tones[tone], className)} {...p} />;
}
