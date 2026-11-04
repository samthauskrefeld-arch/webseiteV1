"use client";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const control = "w-full rounded-[14px] border border-border bg-surface px-4 text-[16px] text-text placeholder:text-muted/80 transition-[border,box-shadow] duration-200 focus:border-focus focus:outline-none focus:ring-4 focus:ring-focus/20 aria-[invalid=true]:border-error disabled:opacity-60";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
  className?: string;
}
export function Field({ label, error, hint, optional, children, className }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-[13px] font-medium text-error-text">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(control, "h-12", className)} {...p} />);
Input.displayName = "Input";
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(control, "min-h-28 py-3", className)} {...p} />);
Textarea.displayName = "Textarea";
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(control, "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23657387%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_16px_center] bg-no-repeat pr-10", className)} {...p} />);
Select.displayName = "Select";

export function Checkbox({ label, description, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-1", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-[var(--c-accent-hover)]" {...p} />
      <span className="text-[15px] leading-6">
        {label}
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 min-h-7", checked ? "bg-accent-hover" : "bg-border")}>
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-soft)]", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}
