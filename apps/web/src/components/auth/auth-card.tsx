import { LogoMark } from "@/components/shell/logo";
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark className="mb-4 size-12" />
        <h1 className="text-[28px] leading-9">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
      </div>
      <div className="rounded-[20px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">{children}</div>
    </div>
  );
}
