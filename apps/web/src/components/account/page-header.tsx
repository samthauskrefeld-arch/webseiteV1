import { ChevronLeft } from "lucide-react";
import Link from "next/link";
export function PageHeader({ title, back = "/konto", backLabel = "Mein Konto", children, description }: { title: string; back?: string | null; backLabel?: string; children?: React.ReactNode; description?: string }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back} className="no-print mb-3 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted hover:text-text">
          <ChevronLeft className="size-4" aria-hidden /> {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{title}</h1>
          {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
