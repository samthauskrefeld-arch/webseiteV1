import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
const map = {
  info: { icon: Info, cls: "border-primary/15 bg-primary/5 text-text" },
  success: { icon: CheckCircle2, cls: "border-success/25 bg-success/8 text-text" },
  warning: { icon: AlertTriangle, cls: "border-warning/30 bg-warning/10 text-text" },
  error: { icon: XCircle, cls: "border-error/30 bg-error/8 text-text" },
};
export function Notice({ tone = "info", title, children, className }: { tone?: keyof typeof map; title?: string; children?: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = map[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-[14px] border p-4 text-[15px]", cls, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", { info: "text-primary", success: "text-success-text", warning: "text-warning-text", error: "text-error-text" }[tone])} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[14px] leading-6 text-text/90">{children}</div>}
      </div>
    </div>
  );
}
